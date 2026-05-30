import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import { getOpenAiApiKey } from "@/server/openai/keys";

export type StudyGeneratedCardLevel = "advanced" | "beginner" | "intermediate";

export type StudyGeneratedFlashcardDraft = {
  answer: string;
  confidence: number;
  hint?: string;
  level: StudyGeneratedCardLevel;
  question: string;
  sourceNotes?: string;
};

export type StudyGeneratedDeckDraft = {
  cards: StudyGeneratedFlashcardDraft[];
  description: string;
  generationMode: "ai" | "mock";
  generationWarnings: string[];
  promptInstructions?: string;
  sourceSummary: string;
  subject?: string;
  tags: string[];
  title: string;
};

type RawGeneratedDeckDraft = {
  cards?: unknown;
  description?: unknown;
  generationWarnings?: unknown;
  sourceSummary?: unknown;
  subject?: unknown;
  tags?: unknown;
  title?: unknown;
};

const GENERATE_MODEL = "gpt-4o";
const MAX_SOURCE_CHARS = 24_000;
const MAX_INSTRUCTION_CHARS = 2_000;

function clean(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanOptional(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function clampConfidence(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.55;
  }
  return Math.min(0.95, Math.max(0.1, value));
}

function normalizeLevel(value: unknown, index: number): StudyGeneratedCardLevel {
  if (value === "advanced" || value === "beginner" || value === "intermediate") {
    return value;
  }
  return index < 2 ? "beginner" : index < 5 ? "intermediate" : "advanced";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
}

function rawCards(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Partial<StudyGeneratedFlashcardDraft> => typeof item === "object" && item !== null)
    : [];
}

function extractJsonObject(raw: string) {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  return first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;
}

function sentenceCandidates(sourceText: string) {
  return sourceText
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 40)
    .slice(0, 8);
}

function titleFromText(sourceText: string, promptInstructions?: string) {
  const instructionTitle = promptInstructions
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^title\s*:/i.test(line))
    ?.replace(/^title\s*:/i, "")
    .trim();

  if (instructionTitle) {
    return instructionTitle.slice(0, 90);
  }

  const firstLine = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length >= 8);

  return firstLine ? firstLine.slice(0, 90) : "Draft Study Deck";
}

function mockDraft(args: {
  promptInstructions?: string;
  sourceText: string;
}): StudyGeneratedDeckDraft {
  const title = titleFromText(args.sourceText, args.promptInstructions);
  const candidates = sentenceCandidates(args.sourceText);
  const cards = (candidates.length > 0 ? candidates : [args.sourceText.slice(0, 240)])
    .slice(0, 6)
    .map((sentence, index) => {
      const concept = sentence
        .replace(/^[^A-Za-z0-9]+/, "")
        .split(/\s+/)
        .slice(0, 8)
        .join(" ");

      return {
        answer: sentence.slice(0, 320),
        confidence: 0.55,
        hint: "Review the source text before publishing.",
        level: normalizeLevel(undefined, index),
        question: `What should a learner remember about ${concept || "this source"}?`,
        sourceNotes: "Deterministic fallback draft from source text; not AI-verified.",
      };
    });

  return {
    cards,
    description: "Reviewable Study deck draft generated from provided source text.",
    generationMode: "mock",
    generationWarnings: [
      "OpenAI is not configured, so this is a deterministic fallback draft.",
      "Review all cards before publishing. Generation does not mark cards Verified or Official.",
    ],
    promptInstructions: args.promptInstructions,
    sourceSummary: args.sourceText.slice(0, 500),
    subject: undefined,
    tags: ["content-studio", "draft"],
    title,
  };
}

function normalizeDraft(raw: RawGeneratedDeckDraft, args: {
  promptInstructions?: string;
  sourceText: string;
}): StudyGeneratedDeckDraft {
  const cards = rawCards(raw.cards)
    .map((card, index): StudyGeneratedFlashcardDraft | undefined => {
      const question = clean(card.question);
      const answer = clean(card.answer);
      if (!question || !answer) {
        return undefined;
      }

      return {
        answer,
        confidence: clampConfidence(card.confidence),
        hint: cleanOptional(card.hint),
        level: normalizeLevel(card.level, index),
        question,
        sourceNotes: cleanOptional(card.sourceNotes),
      };
    })
    .filter((card): card is StudyGeneratedFlashcardDraft => Boolean(card))
    .slice(0, 30);

  return {
    cards,
    description: clean(raw.description, "Reviewable Study deck draft generated from source material."),
    generationMode: "ai",
    generationWarnings: [
      ...stringArray(raw.generationWarnings).map((item) => item.trim()),
      "Generation is not verification. Review before publishing and run verification separately.",
    ],
    promptInstructions: args.promptInstructions,
    sourceSummary: clean(raw.sourceSummary, args.sourceText.slice(0, 500)),
    subject: cleanOptional(raw.subject),
    tags: stringArray(raw.tags)
      .map((tag) => tag.trim())
      .slice(0, 8),
    title: clean(raw.title, titleFromText(args.sourceText, args.promptInstructions)),
  };
}

function buildGenerationPrompt(args: {
  promptInstructions?: string;
  sourceText: string;
}) {
  return `Create a reviewable QuesIQ Study flashcard deck draft from the source text.

This is a generation step only. Do not mark anything Verified. Do not call the deck Official. Official status is an admin/QuesIQ curation decision after review.

Return only JSON with this exact shape:
{
  "title": "Deck title",
  "description": "Short deck description",
  "subject": "Optional subject",
  "tags": ["short", "tags"],
  "sourceSummary": "Brief source summary",
  "generationWarnings": ["Any issues, gaps, or review needs"],
  "cards": [
    {
      "question": "One clear question",
      "answer": "Concise but complete answer",
      "hint": "Optional hint",
      "level": "beginner | intermediate | advanced",
      "sourceNotes": "Brief source grounding or uncertainty note",
      "confidence": 0.0
    }
  ]
}

Guidelines:
- Create 8-16 cards unless source text is short.
- Each card should test one concept.
- Prefer source-grounded questions over general knowledge.
- Use confidence for generation/source-grounding confidence only, not verification confidence.
- Add generationWarnings for missing context, safety-sensitive claims, thin source text, or source ambiguity.
- Be conservative for medical, legal, aviation, financial, emergency, and safety-sensitive topics.

Prompt instructions:
${args.promptInstructions || "None"}

Source text:
${args.sourceText.slice(0, MAX_SOURCE_CHARS)}`;
}

export async function generateStudyFlashcardDeckDraft(args: {
  promptInstructions?: string;
  sourceText: string;
  userId?: string;
}): Promise<StudyGeneratedDeckDraft> {
  const sourceText = args.sourceText.trim().slice(0, MAX_SOURCE_CHARS);
  const promptInstructions = args.promptInstructions?.trim().slice(0, MAX_INSTRUCTION_CHARS) || undefined;

  if (sourceText.length < 40) {
    throw new Error("Source text must be at least 40 characters.");
  }

  const apiKey = getOpenAiApiKey("study");
  if (!apiKey) {
    return mockDraft({ promptInstructions, sourceText });
  }

  const prompt = buildGenerationPrompt({ promptInstructions, sourceText });
  const aiRun = await startAiRun({
    model: GENERATE_MODEL,
    promptSnapshot: prompt,
    rawJson: {
      operation: "study_content_studio_flashcard_draft",
      promptInstructionsLength: promptInstructions?.length ?? 0,
      sourceTextLength: sourceText.length,
    },
    runType: "study_import",
    userId: args.userId,
  });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      body: JSON.stringify({
        max_tokens: 4096,
        messages: [{ content: prompt, role: "user" }],
        model: GENERATE_MODEL,
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
      throw new Error(payload.error?.message || "Study flashcard draft generation failed.");
    }

    const raw = payload.choices?.[0]?.message?.content ?? "{}";
    const draft = normalizeDraft(JSON.parse(extractJsonObject(raw)) as RawGeneratedDeckDraft, {
      promptInstructions,
      sourceText,
    });

    await completeAiRun(aiRun.id, {
      costSource: payload.usage ? "exact" : "unavailable",
      inputTokens: payload.usage?.prompt_tokens,
      outputTokens: payload.usage?.completion_tokens,
      providerRequestId: payload.id,
      rawJson: {
        cardCount: draft.cards.length,
        generationWarnings: draft.generationWarnings,
        operation: "study_content_studio_flashcard_draft",
        usage: payload.usage,
      },
      status: "succeeded",
      totalTokens: payload.usage?.total_tokens,
    });

    return draft;
  } catch (error) {
    await completeAiRun(aiRun.id, {
      errorMessage: error instanceof Error ? error.message : "Study flashcard draft generation failed.",
      status: "failed",
    });
    throw error;
  }
}
