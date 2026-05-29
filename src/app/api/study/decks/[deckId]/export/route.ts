import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { getStudyDeck, getStudyDeckCards } from "@/features/study/study-data";

type Params = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

function escapeDelimited(value: string, delimiter: "," | "\t") {
  const normalized = value.replace(/\r?\n/g, " ").trim();
  const needsQuote =
    normalized.includes('"') || normalized.includes("\n") || normalized.includes("\r") || normalized.includes(delimiter);
  if (!needsQuote) {
    return normalized;
  }
  return `"${normalized.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest, { params }: Params) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawDeckId = (await params).deckId;
  const deckId = Array.isArray(rawDeckId) ? rawDeckId[0] : rawDeckId;

  if (!deckId) {
    return NextResponse.json({ error: "Missing deck id." }, { status: 400 });
  }
  const deck = await getStudyDeck(deckId);

  if (!deck) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (deck.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (deck.isPublic || deck.isOfficial) {
    return NextResponse.json(
      { error: "Export is only allowed for private, non-official decks." },
      { status: 403 },
    );
  }

  const format = request.nextUrl.searchParams.get("format") === "tsv" ? "tsv" : "csv";
  const delimiter = format === "tsv" ? "\t" : ",";
  const cards = await getStudyDeckCards(deckId);
  const rows = [
    ["question", "answer", "hint"].join(delimiter),
    ...cards.map((card) =>
      [card.question, card.answer, card.hint ?? ""]
        .map((value) => escapeDelimited(value, delimiter))
        .join(delimiter),
    ),
  ];
  const body = `${rows.join("\n")}\n`;
  const safeTitle = (deck.title || "study-deck").replace(/[^a-z0-9-_]+/gi, "-");
  const ext = format === "tsv" ? "tsv" : "csv";

  return new NextResponse(body, {
    headers: {
      "Content-Disposition": `attachment; filename="${safeTitle}.${ext}"`,
      "Content-Type": "text/plain; charset=utf-8",
    },
    status: 200,
  });
}
