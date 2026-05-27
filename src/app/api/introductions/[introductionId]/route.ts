import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type { IntroAudience, IntroLength } from "@/product/interview-types";
import type { IntroductionInput } from "@/server/introductions/introductions";
import {
  deleteIntroduction,
  updateIntroduction,
} from "@/server/introductions/introductions";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    introductionId: string;
  }>;
};

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

export async function PUT(request: Request, context: RouteContext) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const { introductionId } = await context.params;
  const body = (await request.json()) as { introduction?: unknown };
  const input = parseIntroductionInput(body.introduction);

  if (!input) {
    return NextResponse.json(
      { error: "A title and introduction script are required." },
      { status: 400 },
    );
  }

  try {
    const introduction = await updateIntroduction(
      appSession.user.id,
      introductionId,
      input,
    );

    if (!introduction) {
      return NextResponse.json({ error: "Introduction was not found." }, { status: 404 });
    }

    return NextResponse.json({ introduction });
  } catch (error) {
    console.error("Introduction update failed.", error);

    return NextResponse.json(
      {
        detail:
          error instanceof Error ? error.message : "Introduction could not be updated.",
        error: "Introduction could not be updated.",
      },
      { status: 503 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const { introductionId } = await context.params;

  try {
    const deleted = await deleteIntroduction(appSession.user.id, introductionId);

    if (!deleted) {
      return NextResponse.json({ error: "Introduction was not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Introduction delete failed.", error);

    return NextResponse.json(
      {
        detail:
          error instanceof Error ? error.message : "Introduction could not be deleted.",
        error: "Introduction could not be deleted.",
      },
      { status: 503 },
    );
  }
}
