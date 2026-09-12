import { createRequire } from "node:module";
import { inflateRawSync } from "node:zlib";

export const MAX_RESUME_BYTES = 2 * 1024 * 1024;
export const MAX_RESUME_TEXT_CHARS = 12000;
const MAX_EXTRACTED_TEXT_CHARS = 256000;
const MAX_ZIP_ENTRIES = 128;
const MAX_ZIP_ENTRY_BYTES = 8 * 1024 * 1024;

export type ResumeParseErrorCode = "unsupported" | "empty" | "password" | "unreadable" | "oversize" | "content_mismatch";

export class ResumeParseError extends Error {
  readonly code: ResumeParseErrorCode;
  constructor(code: ResumeParseErrorCode, message: string) { super(message); this.name = "ResumeParseError"; this.code = code; }
}

export type ResumeReviewText = { text: string; truncated: boolean; originalCharacters: number };
type ZipEntry = { compressedSize: number; uncompressedSize: number; compressionMethod: number; localHeaderOffset: number; name: string };

function fail(code: ResumeParseErrorCode, message: string): never { throw new ResumeParseError(code, message); }
function extensionFor(fileName: string) { return fileName.split(".").at(-1)?.toLowerCase(); }
function validUtf8(buffer: Buffer) { const text = buffer.toString("utf8"); return text.includes("\uFFFD") ? fail("unreadable", "Resume text is not valid UTF-8.") : text; }
function cleanText(text: string) { return text.replace(/\u0000/g, " ").replace(/[ \t\r\f\v]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(); }
function boundedText(text: string) { const clean = cleanText(text); if (clean.length > MAX_EXTRACTED_TEXT_CHARS) fail("oversize", "Extracted text is too large. Paste a shorter resume instead."); return clean; }
function reviewResult(text: string): ResumeReviewText {
  const bounded = boundedText(text);
  if (!bounded) fail("empty", "Resume did not contain readable text.");
  return { text: bounded, truncated: bounded.length > MAX_RESUME_TEXT_CHARS, originalCharacters: bounded.length };
}
function assertSize(buffer: Buffer) { if (buffer.length > MAX_RESUME_BYTES) fail("oversize", "Resume must be 2 MB or smaller."); if (!buffer.length) fail("empty", "Resume file is empty."); }
function isZip(buffer: Buffer) { return buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50; }

function findZipEntries(buffer: Buffer): ZipEntry[] {
  const min = Math.max(0, buffer.length - (0xffff + 22));
  for (let index = buffer.length - 22; index >= min; index -= 1) {
    if (buffer.readUInt32LE(index) !== 0x06054b50) continue;
    const entryCount = buffer.readUInt16LE(index + 10), centralSize = buffer.readUInt32LE(index + 12), centralOffset = buffer.readUInt32LE(index + 16);
    if (entryCount > MAX_ZIP_ENTRIES || centralOffset + centralSize > buffer.length) fail("oversize", "Resume archive exceeds safe limits.");
    const entries: ZipEntry[] = []; let offset = centralOffset;
    for (let i = 0; i < entryCount; i += 1) {
      if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) fail("unreadable", "Resume archive has a malformed directory.");
      const compressionMethod = buffer.readUInt16LE(offset + 10), compressedSize = buffer.readUInt32LE(offset + 20), uncompressedSize = buffer.readUInt32LE(offset + 24);
      const nameLength = buffer.readUInt16LE(offset + 28), extraLength = buffer.readUInt16LE(offset + 30), commentLength = buffer.readUInt16LE(offset + 32), localHeaderOffset = buffer.readUInt32LE(offset + 42);
      const end = offset + 46 + nameLength + extraLength + commentLength;
      if (end > buffer.length || uncompressedSize > MAX_ZIP_ENTRY_BYTES || compressedSize > buffer.length) fail("oversize", "Resume archive entry exceeds safe limits.");
      const name = validUtf8(buffer.subarray(offset + 46, offset + 46 + nameLength));
      entries.push({ compressedSize, uncompressedSize, compressionMethod, localHeaderOffset, name }); offset = end;
    }
    if (offset > centralOffset + centralSize) fail("unreadable", "Resume archive directory is invalid.");
    return entries;
  }
  fail("unreadable", "Resume archive is missing its directory.");
}

function readZipEntry(buffer: Buffer, entry: ZipEntry) {
  const offset = entry.localHeaderOffset;
  if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50) fail("unreadable", "Resume archive has a malformed entry.");
  const nameLength = buffer.readUInt16LE(offset + 26), extraLength = buffer.readUInt16LE(offset + 28), dataStart = offset + 30 + nameLength + extraLength, dataEnd = dataStart + entry.compressedSize;
  if (dataStart > buffer.length || dataEnd > buffer.length) fail("unreadable", "Resume archive entry is truncated.");
  const compressed = buffer.subarray(dataStart, dataEnd);
  try {
    if (entry.compressionMethod === 0) return compressed.length > MAX_ZIP_ENTRY_BYTES ? fail("oversize", "Resume archive entry exceeds safe limits.") : compressed;
    if (entry.compressionMethod === 8) return inflateRawSync(compressed, { maxOutputLength: MAX_ZIP_ENTRY_BYTES });
  } catch { fail("unreadable", "Resume archive entry could not be decompressed."); }
  fail("unreadable", "Resume archive uses an unsupported compression method.");
}

function extractDocx(buffer: Buffer) {
  if (!isZip(buffer)) fail("content_mismatch", "DOCX file is not a valid ZIP document.");
  const entry = findZipEntries(buffer).find((item) => item.name === "word/document.xml");
  if (!entry) fail("unreadable", "DOCX document content is missing.");
  const xml = validUtf8(readZipEntry(buffer, entry));
  if (!/<w:document[\s>]/.test(xml) || !/<w:body[\s>]/.test(xml) || /<!DOCTYPE|<!ENTITY/i.test(xml)) fail("content_mismatch", "DOCX content is not a supported Word document.");
  return xml.replace(/<w:tab\s*\/?>/g, " ").replace(/<\/w:p\s*>/g, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

const require = createRequire(import.meta.url);
async function extractPdf(buffer: Buffer) {
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") fail("content_mismatch", "PDF signature is invalid.");
  try {
    const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (data: Uint8Array, options?: { max?: number }) => Promise<{ text: string; numpages: number }>;
    // Older bundled PDF.js expects a zero-offset owned byte array, not a
    // pooled Node Buffer whose ArrayBuffer also contains other documents.
    const result = await pdfParse(new Uint8Array(buffer), { max: 100 });
    if (!Number.isInteger(result.numpages) || result.numpages < 1 || result.numpages > 100) fail("oversize", "PDF has too many pages.");
    return result.text;
  } catch (error) {
    if (error instanceof ResumeParseError) throw error;
    const message = String(error).toLowerCase();
    if (message.includes("password") || message.includes("encrypted")) fail("password", "Password-protected PDFs are not supported.");
    fail("unreadable", "PDF could not be read.");
  }
}

export async function extractResumeForReview(fileName: string, mimeType: string, buffer: Buffer): Promise<ResumeReviewText> {
  assertSize(buffer); const extension = extensionFor(fileName); const mime = mimeType.toLowerCase(); let text: string;
  if (["md", "markdown", "text", "txt"].includes(extension || "") || ["text/plain", "text/markdown"].includes(mime)) {
    if (isZip(buffer) || buffer.subarray(0, 5).toString("latin1") === "%PDF-") fail("content_mismatch", "Text file signature does not match its contents.");
    text = validUtf8(buffer);
  } else if (extension === "docx" || mime.includes("wordprocessingml.document")) text = extractDocx(buffer);
  else if (extension === "pdf" || mime === "application/pdf") text = await extractPdf(buffer);
  else fail("unsupported", "Resume file type is not supported.");
  return reviewResult(text);
}

export async function extractResumeText(fileName: string, mimeType: string, buffer: Buffer): Promise<string> {
  return (await extractResumeForReview(fileName, mimeType, buffer)).text.slice(0, MAX_RESUME_TEXT_CHARS);
}
