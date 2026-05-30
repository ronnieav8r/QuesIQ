import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type { IntroAudience, IntroLength } from "@/product/interview-types";
import { generateIntroductionDraft } from "@/server/introductions/introduction-ai";
import { getOpenAiApiKey } from "@/server/openai/keys";

export const runtime = "nodejs";

const audienceOptions: IntroAudience[] = ["hr_phone", "in_person", "virtual"];
const lengthOptions: IntroLength[] = ["long", "medium", "short"];

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!getOpenAiApiKey("interview")) {
    return NextResponse.json(
      {
        detail: "Introduction drafting needs the Interview OpenAI key configured.",
        error: "Introduction draft could not be generated.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json()) as {
    audience?: IntroAudience;
    jobDescription?: unknown;
    length?: IntroLength;
    rawNotes?: unknown;
    targetCompany?: unknown;
    targetRole?: unknown;
  };
  const rawNotes = clean(body.rawNotes);
  const audience = body.audience;
  const length = body.length;

  if (
    !rawNotes ||
    !audienceOptions.includes(audience as IntroAudience) ||
    !lengthOptions.includes(length as IntroLength)
  ) {
    return NextResponse.json(
      { error: "Raw introduction notes, audience, and length are required." },
      { status: 400 },
    );
  }

  try {
    const draft = await generateIntroductionDraft({
      audience: audience as IntroAudience,
      jobDescription: clean(body.jobDescription),
      length: length as IntroLength,
      rawNotes,
      targetCompany: clean(body.targetCompany),
      targetRole: clean(body.targetRole),
      userId: appSession.user.id,
    });

    return NextResponse.json({ draft });
  } catch (error) {
    console.error("Introduction draft generation failed.", error);

    return NextResponse.json(
      {
        detail:
          error instanceof Error
            ? error.message
            : "Introduction draft could not be generated.",
        error: "Introduction draft could not be generated.",
      },
      { status: 503 },
    );
  }
}
