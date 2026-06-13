import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import { getDb } from "@/server/db/client";
import { studyCards, studyDecks, studyVerifications } from "@/server/db/schema";
import { getOpenAiApiKey } from "@/server/openai/keys";

const VERIFY_CONFIDENCE_THRESHOLD = 0.8;
const VERIFY_MODEL = "gpt-4o";

type StudyVerificationStatus = "insufficient_evidence" | "needs_revision" | "verified";

type StudyVerificationResult = {
  cardId: string;
  confidence: number;
  note: string;
  status: StudyVerificationStatus;
};

type StudyVerificationPayload = {
  results?: Array<{
    cardId?: string;
    confidence?: number;
    note?: string;
    status?: string;
  }>;
  summary?: string;
};

function clampConfidence(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function normalizeStatus(value: unknown): StudyVerificationStatus {
  if (value === "verified" || value === "needs_revision" || value === "insufficient_evidence") {
    return value;
  }
  return "insufficient_evidence";
}

function parseVerificationPayload(raw: string, cardIds: Set<string>) {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
  const parsed = JSON.parse(cleaned) as StudyVerificationPayload;
  const results = (parsed.results ?? [])
    .map((item): StudyVerificationResult | undefined => {
      if (!item.cardId || !cardIds.has(item.cardId)) {
        return undefined;
      }

      const confidence = clampConfidence(item.confidence);
      const status = normalizeStatus(item.status);
      return {
        cardId: item.cardId,
        confidence,
        note: item.note?.trim() || "No verification note returned.",
        status,
      };
    })
    .filter((item): item is StudyVerificationResult => Boolean(item));

  return {
    results,
    summary: parsed.summary?.trim() || "AI verification completed.",
  };
}

function buildVerificationPrompt(input: {
  cards: Array<{ answer: string; id: string; question: string }>;
  deck: {
    description: string | null;
    subject: string | null;
    tags: string[] | null;
    title: string;
  };
}) {
  return `You are checking a QuesIQ Study flashcard deck for factual accuracy and source-check confidence.

This is a lightweight AI verification pass, not a certification or guarantee.

Deck:
Title: ${input.deck.title}
Description: ${input.deck.description ?? "Not provided"}
Subject: ${input.deck.subject ?? "Not provided"}
Tags: ${(input.deck.tags ?? []).join(", ") || "None"}

Cards:
${input.cards
  .map(
    (card, index) => `${index + 1}. cardId: ${card.id}
Question: ${card.question}
Answer: ${card.answer}`,
  )
  .join("\n\n")}

For each card, decide whether the question and answer are accurate enough to mark verified.

Criteria:
- Use status "verified" only when the answer is factually correct, the card is clear, and confidence is at least ${VERIFY_CONFIDENCE_THRESHOLD}.
- Use status "needs_revision" when there is a factual error, misleading phrasing, unsafe guidance, unclear answer, or a substantive issue.
- Use status "insufficient_evidence" when the card may be correct but cannot be checked with enough confidence.
- Be conservative for legal, medical, aviation, financial, emergency, or safety-sensitive content.
- Do not imply certification, authority approval, or professional guarantee.

Return only JSON:
{
  "summary": "One sentence summary of this verification run.",
  "results": [
    {
      "cardId": "matching cardId",
      "status": "verified | needs_revision | insufficient_evidence",
      "confidence": 0.0,
      "note": "Short reason for the status."
    }
  ]
}`;
}

export async function verifyStudyDeckWithAi(args: {
  deckId: string;
  userId: string;
}) {
  const db = getDb();
  const [deck] = await db.select().from(studyDecks).where(eq(studyDecks.id, args.deckId)).limit(1);

  if (!deck) {
    return undefined;
  }

  if (deck.isOfficial) {
    throw new Error("Official decks are already QuesIQ-verified and cannot run lightweight AI verification.");
  }

  const cards = await db
    .select({
      answer: studyCards.answer,
      id: studyCards.id,
      question: studyCards.question,
    })
    .from(studyCards)
    .where(eq(studyCards.deckId, args.deckId))
    .orderBy(asc(studyCards.position));

  if (cards.length === 0) {
    return {
      cardsReviewed: 0,
      results: [] as StudyVerificationResult[],
      summary: "No cards to verify.",
      verifiedCount: 0,
    };
  }

  const apiKey = getOpenAiApiKey("study");
  if (!apiKey) {
    throw new Error("Study OpenAI key is not configured.");
  }

  const prompt = buildVerificationPrompt({ cards, deck });
  const aiRun = await startAiRun({
    model: VERIFY_MODEL,
    promptSnapshot: prompt,
    rawJson: {
      cardCount: cards.length,
      deckId: args.deckId,
      operation: "study_deck_verification",
      threshold: VERIFY_CONFIDENCE_THRESHOLD,
    },
    runType: "study_evaluate",
    userId: args.userId,
  });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      body: JSON.stringify({
        max_tokens: Math.min(4096, 500 + cards.length * 180),
        messages: [{ content: prompt, role: "user" }],
        model: VERIFY_MODEL,
        response_format: { type: "json_object" },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
      id?: string;
      usage?: {
        completion_tokens?: number;
        prompt_tokens?: number;
        total_tokens?: number;
      };
    };

    if (!response.ok) {
      throw new Error(payload.error?.message || "Study deck verification failed.");
    }

    const cardIds = new Set(cards.map((card) => card.id));
    const parsed = parseVerificationPayload(payload.choices?.[0]?.message?.content ?? "{}", cardIds);
    const returnedCardIds = new Set(parsed.results.map((result) => result.cardId));
    const results: StudyVerificationResult[] = [
      ...parsed.results,
      ...cards
        .filter((card) => !returnedCardIds.has(card.id))
        .map((card) => ({
          cardId: card.id,
          confidence: 0,
          note: "AI verification did not return a result for this card.",
          status: "insufficient_evidence" as const,
        })),
    ];

    const verifiedCardIds = results
      .filter(
        (result) =>
          result.status === "verified" && result.confidence >= VERIFY_CONFIDENCE_THRESHOLD,
      )
      .map((result) => result.cardId);
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(studyCards)
        .set({
          isVerified: false,
          updatedAt: now,
          verifiedAt: null,
          verifiedBy: null,
        })
        .where(eq(studyCards.deckId, args.deckId));

      if (verifiedCardIds.length > 0) {
        await tx
          .update(studyCards)
          .set({
            isVerified: true,
            updatedAt: now,
            verifiedAt: now,
            verifiedBy: "ai",
          })
          .where(and(eq(studyCards.deckId, args.deckId), inArray(studyCards.id, verifiedCardIds)));
      }

      await tx.insert(studyVerifications).values(
        results.map((result) => ({
          cardId: result.cardId,
          confidence: result.confidence,
          note: `${result.status}: ${result.note}`.slice(0, 2000),
          verifiedByUserId: args.userId,
        })),
      );

      await tx
        .update(studyDecks)
        .set({
          updatedAt: now,
          verifiedCardCount: sql`(
            select count(*)::int
            from ${studyCards}
            where ${studyCards.deckId} = ${args.deckId}
              and ${studyCards.isVerified} = true
          )`,
        })
        .where(eq(studyDecks.id, args.deckId));
    });

    await completeAiRun(aiRun.id, {
      costSource: payload.usage ? "exact" : "unavailable",
      inputTokens: payload.usage?.prompt_tokens,
      outputTokens: payload.usage?.completion_tokens,
      providerRequestId: payload.id,
      rawJson: {
        results: results.map((result) => ({
          confidence: result.confidence,
          status: result.status,
        })),
        summary: parsed.summary,
        usage: payload.usage,
        verifiedCount: verifiedCardIds.length,
      },
      status: "succeeded",
      totalTokens: payload.usage?.total_tokens,
    });

    return {
      cardsReviewed: cards.length,
      results,
      summary: parsed.summary,
      verifiedCount: verifiedCardIds.length,
    };
  } catch (error) {
    await completeAiRun(aiRun.id, {
      errorMessage: error instanceof Error ? error.message : "Study deck verification failed.",
      status: "failed",
    });
    throw error;
  }
}
