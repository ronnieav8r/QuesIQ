import { InterviewLimitError } from "@/server/interview/beta-safety";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  extractResumeText,
  MAX_RESUME_BYTES,
} from "@/server/profiles/resume-parser";
import { saveResume } from "@/server/profiles/save-resume";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Resume context needs a configured database.",
        error: "Resume could not be saved.",
      },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("resume");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Resume file is required." }, { status: 400 });
  }

  if (file.size > MAX_RESUME_BYTES) {
    return NextResponse.json(
      { error: "Resume must be 2 MB or smaller for this beta slice." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let resumeText: string | undefined;

  try {
    resumeText = await extractResumeText(file.name, file.type, buffer);
  } catch (error) {
    if (error instanceof InterviewLimitError) return NextResponse.json({ error: { code: error.code, message: error.message, retryable: false, requestId: crypto.randomUUID(), limit: error.outcome } }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Resume could not be read. Your previous resume is unchanged." }, { status: 400 });
  }

  try {
    const resume = await saveResume(appSession.user.id, {
      mimeType: file.type || "application/octet-stream",
      name: file.name,
      size: file.size,
      text: resumeText,
    });

    return NextResponse.json({
      resume,
      resumeSummaryGenerated: false,
      resumeSummaryUnavailable: "explicit_review_required",
      warning: resumeText
        ? undefined
        : "Resume was saved by filename, but text could not be extracted from this file.",
    });
  } catch (error) {
    if (error instanceof InterviewLimitError) return NextResponse.json({ error: { code: error.code, message: error.message, retryable: false, requestId: crypto.randomUUID(), limit: error.outcome } }, { status: error.status });
    console.error("Resume save failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not save resume context.",
        error: "Resume could not be saved.",
      },
      { status: 503 },
    );
  }
}
