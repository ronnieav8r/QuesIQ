import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type { IntroAudience, IntroLength } from "@/product/interview-types";
import {
  listIntroductions,
  saveIntroduction,
  type IntroductionInput,
} from "@/server/introductions/introductions";

export const runtime = "nodejs";

const audienceOptions: IntroAudience[] = ["hr_phone", "in_person", "virtual"];
const lengthOptions: IntroLength[] = ["long", "medium", "short"];

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseIntroductionInput(value: unknown): IntroductionInput | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const audience = candidate.audience;
  const length = candidate.length;
  const script = clean(candidate.script);
  const title = clean(candidate.title);

  if (
    !audienceOptions.includes(audience as IntroAudience) ||
    !lengthOptions.includes(length as IntroLength) ||
    !script ||
    !title
  ) {
    return undefined;
  }

  return {
    audience: audience as IntroAudience,
    background: clean(candidate.background),
    length: length as IntroLength,
    proofPoint: clean(candidate.proofPoint),
    rawNotes: clean(candidate.rawNotes),
    roleInterest: clean(candidate.roleInterest),
    script,
    strength: clean(candidate.strength),
    title,
    transition: clean(candidate.transition),
  };
}

export async function GET() {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Introduction Builder needs a configured database.",
        error: "Introductions could not be loaded.",
      },
      { status: 503 },
    );
  }

  try {
    const introductions = await listIntroductions(appSession.user.id);

    return NextResponse.json({ introductions });
  } catch (error) {
    console.error("Introduction list failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load introductions.",
        error: "Introductions could not be loaded.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Introduction Builder needs a configured database.",
        error: "Introduction could not be saved.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json()) as { introduction?: unknown };
  const input = parseIntroductionInput(body.introduction);

  if (!input) {
    return NextResponse.json(
      { error: "A title and introduction script are required." },
      { status: 400 },
    );
  }

  try {
    const introduction = await saveIntroduction(appSession.user.id, input);

    return NextResponse.json({ introduction });
  } catch (error) {
    console.error("Introduction creation failed.", error);

    return NextResponse.json(
      {
        detail:
          error instanceof Error ? error.message : "Introduction could not be saved.",
        error: "Introduction could not be saved.",
      },
      { status: 503 },
    );
  }
}
