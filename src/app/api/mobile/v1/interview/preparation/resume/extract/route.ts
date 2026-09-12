import { InterviewLimitError } from "@/server/interview/beta-safety";
import { NextResponse } from "next/server";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";
import { extractResumeForReview, MAX_RESUME_BYTES } from "@/server/profiles/resume-parser";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  if (Number(request.headers.get("content-length") || 0) > MAX_RESUME_BYTES + 65536) return mobileApiError("oversized", "Resume must be 2 MB or smaller.", 413);
  try {
    // Bound the entire multipart body, including clients without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return mobileApiError("missing_file", "Choose a resume file.", 400);
    const chunks: Uint8Array[] = []; let total = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; total += value.length;
      if (total > MAX_RESUME_BYTES + 65536) { await reader.cancel(); return mobileApiError("oversized", "Resume must be 2 MB or smaller.", 413); } chunks.push(value); }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
    const file = form.get("resume");
    if (!(file instanceof File)) return mobileApiError("missing_file", "Choose a resume file.", 400);
    const result = await extractResumeForReview(file.name, file.type, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ ...result, name: file.name.slice(0, 255), mimeType: file.type, size: file.size });
  } catch (error) {
    if (error instanceof InterviewLimitError) return NextResponse.json({ error: { code: error.code, message: error.message, retryable: false, requestId: crypto.randomUUID(), limit: error.outcome } }, { status: error.status });
    return mobileApiError("extraction_failed", error instanceof Error ? error.message : "Resume could not be read. Paste its text instead.", 400);
  }
}
