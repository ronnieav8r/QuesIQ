import { inflateRawSync } from "node:zlib";

export const MAX_RESUME_BYTES = 2 * 1024 * 1024;
export const MAX_RESUME_TEXT_CHARS = 12000;

type ZipEntry = {
  compressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
  name: string;
};

function cleanText(text: string) {
  return text
    .replace(/\u0000/g, " ")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_RESUME_TEXT_CHARS);
}

function extensionFor(fileName: string) {
  return fileName.split(".").at(-1)?.toLowerCase();
}

function extractTextFile(buffer: Buffer) {
  return cleanText(buffer.toString("utf8"));
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function findZipEntries(buffer: Buffer): ZipEntry[] {
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) !== 0x06054b50) {
      continue;
    }

    const entryCount = buffer.readUInt16LE(index + 10);
    const centralDirectoryOffset = buffer.readUInt32LE(index + 16);
    const entries: ZipEntry[] = [];
    let offset = centralDirectoryOffset;

    for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
      if (buffer.readUInt32LE(offset) !== 0x02014b50) {
        break;
      }

      const compressionMethod = buffer.readUInt16LE(offset + 10);
      const compressedSize = buffer.readUInt32LE(offset + 20);
      const nameLength = buffer.readUInt16LE(offset + 28);
      const extraLength = buffer.readUInt16LE(offset + 30);
      const commentLength = buffer.readUInt16LE(offset + 32);
      const localHeaderOffset = buffer.readUInt32LE(offset + 42);
      const nameStart = offset + 46;
      const name = buffer.toString("utf8", nameStart, nameStart + nameLength);

      entries.push({ compressedSize, compressionMethod, localHeaderOffset, name });
      offset = nameStart + nameLength + extraLength + commentLength;
    }

    return entries;
  }

  return [];
}

function readZipEntry(buffer: Buffer, entry: ZipEntry) {
  const offset = entry.localHeaderOffset;

  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    return undefined;
  }

  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return compressed;
  }

  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressed);
  }

  return undefined;
}

function extractDocx(buffer: Buffer) {
  const documentEntry = findZipEntries(buffer).find(
    (entry) => entry.name === "word/document.xml",
  );
  const documentXml = documentEntry ? readZipEntry(buffer, documentEntry) : undefined;

  if (!documentXml) {
    return undefined;
  }

  const text = decodeXml(
    documentXml
      .toString("utf8")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:tab\/>/g, " ")
      .replace(/<[^>]+>/g, " "),
  );

  return cleanText(text);
}

function unescapePdfString(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\\d{1,3}/g, " ");
}

function extractPdfBestEffort(buffer: Buffer) {
  const source = buffer.toString("latin1");
  const pieces = Array.from(source.matchAll(/\((?:\\.|[^\\)]){2,}\)/g))
    .map((match) => unescapePdfString(match[0].slice(1, -1)))
    .filter((piece) => /[A-Za-z]{2}/.test(piece));

  return pieces.length > 0 ? cleanText(pieces.join(" ")) : undefined;
}

export function extractResumeText(fileName: string, mimeType: string, buffer: Buffer) {
  const extension = extensionFor(fileName);

  if (["md", "text", "txt"].includes(extension || "") || mimeType.startsWith("text/")) {
    return extractTextFile(buffer);
  }

  if (extension === "docx" || mimeType.includes("wordprocessingml.document")) {
    return extractDocx(buffer);
  }

  if (extension === "pdf" || mimeType === "application/pdf") {
    return extractPdfBestEffort(buffer);
  }

  return undefined;
}
