import { deflateRawSync } from "node:zlib";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { extractResumeForReview, extractResumeText, MAX_RESUME_BYTES, ResumeParseError } from "./resume-parser";

function expectCode(promise: Promise<unknown>, code: ResumeParseError["code"]) {
  return assert.rejects(promise, (error: unknown) => error instanceof ResumeParseError && error.code === code);
}

function docx(document: string) {
  const name = Buffer.from("word/document.xml"); const body = deflateRawSync(Buffer.from(document));
  const local = Buffer.alloc(30 + name.length); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(Buffer.byteLength(document), 22); local.writeUInt16LE(name.length, 26); name.copy(local, 30);
  const central = Buffer.alloc(46 + name.length); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(Buffer.byteLength(document), 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(0, 42); name.copy(central, 46);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(local.length + body.length, 16);
  return Buffer.concat([local, body, central, end]);
}

test("extracts UTF-8 text and explicitly reports review truncation", async () => {
  const result = await extractResumeForReview("resume.txt", "text/plain", Buffer.from("Name\n" + "x".repeat(13000)));
  assert.equal(result.text.length, 13005); assert.equal(result.truncated, true); assert.equal(result.originalCharacters, 13005);
  assert.equal(await extractResumeText("resume.txt", "text/plain", Buffer.from("Hello")), "Hello");
});

test("extracts DOCX XML text with bounded ZIP handling", async () => {
  const result = await extractResumeForReview("resume.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", docx("<w:document><w:body><w:p><w:r><w:t>Jane &amp; Co</w:t></w:r></w:p></w:body></w:document>"));
  assert.equal(result.text, "Jane & Co");
});

test("rejects unsupported, empty, oversize and mismatched content", async () => {
  await expectCode(extractResumeForReview("resume.rtf", "application/rtf", Buffer.from("x")), "unsupported");
  await expectCode(extractResumeForReview("resume.txt", "text/plain", Buffer.alloc(0)), "empty");
  await expectCode(extractResumeForReview("resume.txt", "text/plain", Buffer.alloc(MAX_RESUME_BYTES + 1)), "oversize");
  await expectCode(extractResumeForReview("resume.txt", "text/plain", Buffer.from("%PDF-1.7")), "content_mismatch");
  await expectCode(extractResumeForReview("resume.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", Buffer.from("not zip")), "content_mismatch");
});

test("rejects malformed and unsafe ZIP archives without exposing raw errors", async () => {
  const malformed = Buffer.alloc(22); malformed.writeUInt32LE(0x06054b50, 0); malformed.writeUInt16LE(1, 8); malformed.writeUInt16LE(1, 10); malformed.writeUInt32LE(46, 12);
  await expectCode(extractResumeForReview("resume.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", Buffer.concat([Buffer.from("PK\x03\x04"), malformed])), "oversize");
});

test("requires a real PDF signature before invoking the parser", async () => {
  await expectCode(extractResumeForReview("resume.pdf", "application/pdf", Buffer.from("not a pdf")), "content_mismatch");
});

function pdf(text: string) {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let source = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((body, i) => { offsets.push(Buffer.byteLength(source)); source += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(source);
  source += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(source);
}
test("extracts actual PDF text and rejects pages with no readable text", async () => {
  assert.match((await extractResumeForReview("resume.pdf", "application/pdf", pdf("Jane led a team"))).text, /Jane led a team/);
  await expectCode(extractResumeForReview("scan.pdf", "application/pdf", pdf("")), "empty");
});
