import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  getStudyDeck,
  recordStudyCardFeedback,
  type StudyCardFeedbackIssueType,
  type StudyCardFeedbackType,
} from "@/features/study/study-data";

const validFeedbackTypes: StudyCardFeedbackType[] = ["accurate", "issue"];
const validIssueTypes: StudyCardFeedbackIssueType[] = [
  "incorrect",
  "other",
  "source_issue",
  "typo",
  "unclear",
];

type Params = {
  params: Promise<{ deckId: string }>;
};

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function cleanMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deckId } = await params;
  const deck = await getStudyDeck(deckId);

  if (!deck) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!deck.isPublic && deck.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    cardId?: string;
    feedbackType?: StudyCardFeedbackType;
    issueType?: StudyCardFeedbackIssueType;
    metadata?: unknown;
    note?: string;
    screen?: string;
  };

  if (!body.cardId || !body.feedbackType || !validFeedbackTypes.includes(body.feedbackType)) {
    return NextResponse.json({ error: "Missing or invalid fields." }, { status: 400 });
  }

  const issueType =
    body.feedbackType === "issue" && body.issueType && validIssueTypes.includes(body.issueType)
      ? body.issueType
      : null;
  const note = cleanString(body.note, 1500);

  const feedback = await recordStudyCardFeedback({
    cardId: body.cardId,
    deckId,
    feedbackType: body.feedbackType,
    issueType,
    metadata: cleanMetadata(body.metadata),
    note,
    screen: cleanString(body.screen, 80),
    userId: session.user.id,
  });

  if (!feedback) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  }

  return NextResponse.json({ feedback }, { status: 201 });
}
