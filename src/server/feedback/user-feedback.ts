import { desc, eq } from "drizzle-orm";

import type { FeedbackKind, FeedbackRecord } from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { userFeedback, users } from "@/server/db/schema";

type CreateFeedbackInput = {
  browserLanguage?: string;
  kind: FeedbackKind;
  message?: string;
  ratingPrompt?: string;
  rating?: number;
  screen: string;
  screenshotDataUrl?: string;
  screenshotMimeType?: string;
  screenshotName?: string;
  screenshotSize?: number;
  sessionId?: string;
  userAgent?: string;
  userId: string;
  viewport?: string;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

export function parseFeedbackInput(body: unknown): Omit<CreateFeedbackInput, "userId"> | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const candidate = body as Record<string, unknown>;
  const kind = candidate.kind === "bug" ? "bug" : candidate.kind === "feedback" ? "feedback" : undefined;
  const rating =
    typeof candidate.rating === "number" &&
    Number.isInteger(candidate.rating) &&
    candidate.rating >= 1 &&
    candidate.rating <= 5
      ? candidate.rating
      : undefined;
  const message = cleanText(candidate.message, 2000);
  const screen = cleanText(candidate.screen, 80);
  const screenshotDataUrl = cleanText(candidate.screenshotDataUrl, 2_100_000);
  const screenshotSize =
    typeof candidate.screenshotSize === "number" &&
    Number.isInteger(candidate.screenshotSize) &&
    candidate.screenshotSize > 0 &&
    candidate.screenshotSize <= 1_500_000
      ? candidate.screenshotSize
      : undefined;

  if (!kind || !screen || (!message && rating === undefined && !screenshotDataUrl)) {
    return undefined;
  }

  return {
    browserLanguage: cleanText(candidate.browserLanguage, 80),
    kind,
    message,
    ratingPrompt: cleanText(candidate.ratingPrompt, 160),
    rating,
    screen,
    screenshotDataUrl,
    screenshotMimeType: cleanText(candidate.screenshotMimeType, 80),
    screenshotName: cleanText(candidate.screenshotName, 180),
    screenshotSize,
    sessionId: cleanText(candidate.sessionId, 80),
    userAgent: cleanText(candidate.userAgent, 500),
    viewport: cleanText(candidate.viewport, 80),
  };
}

function toRecord(row: {
  browserLanguage: string | null;
  createdAt: Date;
  id: string;
  kind: FeedbackKind;
  message: string | null;
  ratingPrompt: string | null;
  rating: number | null;
  screen: string;
  screenshotDataUrl: string | null;
  screenshotMimeType: string | null;
  screenshotName: string | null;
  screenshotSize: number | null;
  sessionId: string | null;
  status: FeedbackRecord["status"];
  userAgent: string | null;
  userEmail?: string | null;
  userId: string | null;
  viewport: string | null;
}): FeedbackRecord {
  return {
    browserLanguage: row.browserLanguage ?? undefined,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    kind: row.kind,
    message: row.message ?? undefined,
    ratingPrompt: row.ratingPrompt ?? undefined,
    rating: row.rating ?? undefined,
    screen: row.screen,
    screenshotDataUrl: row.screenshotDataUrl ?? undefined,
    screenshotMimeType: row.screenshotMimeType ?? undefined,
    screenshotName: row.screenshotName ?? undefined,
    screenshotSize: row.screenshotSize ?? undefined,
    sessionId: row.sessionId ?? undefined,
    status: row.status,
    userAgent: row.userAgent ?? undefined,
    userEmail: row.userEmail ?? undefined,
    userId: row.userId ?? undefined,
    viewport: row.viewport ?? undefined,
  };
}

export async function createFeedback(input: CreateFeedbackInput) {
  const [created] = await getDb()
    .insert(userFeedback)
    .values({
      browserLanguage: input.browserLanguage,
      kind: input.kind,
      message: input.message,
      rating: input.rating,
      ratingPrompt: input.ratingPrompt,
      screen: input.screen,
      screenshotDataUrl: input.screenshotDataUrl,
      screenshotMimeType: input.screenshotMimeType,
      screenshotName: input.screenshotName,
      screenshotSize: input.screenshotSize,
      sessionId: input.sessionId,
      userAgent: input.userAgent,
      userId: input.userId,
      viewport: input.viewport,
    })
    .returning({
      createdAt: userFeedback.createdAt,
      id: userFeedback.id,
      kind: userFeedback.kind,
      message: userFeedback.message,
      rating: userFeedback.rating,
      ratingPrompt: userFeedback.ratingPrompt,
      screen: userFeedback.screen,
      screenshotDataUrl: userFeedback.screenshotDataUrl,
      screenshotMimeType: userFeedback.screenshotMimeType,
      screenshotName: userFeedback.screenshotName,
      screenshotSize: userFeedback.screenshotSize,
      sessionId: userFeedback.sessionId,
      status: userFeedback.status,
    });

  return created;
}

export async function listFeedback(limit = 100): Promise<FeedbackRecord[]> {
  const rows = await getDb()
    .select({
      browserLanguage: userFeedback.browserLanguage,
      createdAt: userFeedback.createdAt,
      id: userFeedback.id,
      kind: userFeedback.kind,
      message: userFeedback.message,
      rating: userFeedback.rating,
      ratingPrompt: userFeedback.ratingPrompt,
      screen: userFeedback.screen,
      screenshotDataUrl: userFeedback.screenshotDataUrl,
      screenshotMimeType: userFeedback.screenshotMimeType,
      screenshotName: userFeedback.screenshotName,
      screenshotSize: userFeedback.screenshotSize,
      sessionId: userFeedback.sessionId,
      status: userFeedback.status,
      userAgent: userFeedback.userAgent,
      userEmail: users.email,
      userId: userFeedback.userId,
      viewport: userFeedback.viewport,
    })
    .from(userFeedback)
    .leftJoin(users, eq(users.id, userFeedback.userId))
    .orderBy(desc(userFeedback.createdAt))
    .limit(limit);

  return rows.map(toRecord);
}
