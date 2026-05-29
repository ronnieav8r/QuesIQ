import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { getStudyDeck } from "@/features/study/study-data";
import {
  parseContentToStudyCards,
  parseMultipleUrlsToStudyCards,
  parseTextToStudyCards,
} from "@/server/study/study-import-parser";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/markdown",
  "text/plain",
];

export async function POST(
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[] | undefined>> },
) {
  const rawParams = await context.params;
  const deckId = typeof rawParams.deckId === "string" ? rawParams.deckId : "";
  if (!deckId) {
    return NextResponse.json({ error: "Missing deck id." }, { status: 400 });
  }
  const appSession = await auth();
  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deck = await getStudyDeck(deckId);
  if (!deck) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (deck.userId !== appSession.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const focusHint = typeof formData.get("focusHint") === "string"
    ? (formData.get("focusHint") as string).trim() || undefined
    : undefined;

  const urlsRaw = formData.get("urls");
  if (typeof urlsRaw === "string" && urlsRaw.trim()) {
    const urls = urlsRaw
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.startsWith("http"));
    if (urls.length === 0) {
      return NextResponse.json({ error: "No valid URLs provided." }, { status: 400 });
    }
    const { cards, failedUrls } = await parseMultipleUrlsToStudyCards({
      focusHint,
      urls,
      userId: appSession.user.id,
    });
    return NextResponse.json({ cards, count: cards.length, failedUrls });
  }

  const text = formData.get("text");
  if (typeof text === "string" && text.trim()) {
    const cards = await parseTextToStudyCards({
      focusHint,
      text,
      userId: appSession.user.id,
    });
    return NextResponse.json({ cards, count: cards.length });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No content provided. Upload a file, paste text, or enter URL(s)." },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File must be under 10 MB." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Use PDF, images, or plain text.` },
      { status: 400 },
    );
  }

  const cards = await parseContentToStudyCards({
    file,
    focusHint,
    userId: appSession.user.id,
  });
  return NextResponse.json({ cards, count: cards.length });
}
