import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import {
  buildDpeDraftReferenceContract,
  type DpeDraftReferenceContract,
  type DpeDraftReferenceItem,
  parseDpeDraftReferenceItems,
} from "@/server/dpe/draft-reference";
import { getOpenAiApiKey } from "@/server/openai/keys";

export type DpeContentDraftCertificate = {
  code?: string;
  id?: string;
  title?: string;
};

export type DpeContentDraftAcs = {
  area?: string;
  elementType?: string;
  reference?: string;
  task?: string;
  title?: string;
};

export type DpeContentDraftInput = {
  acs?: DpeContentDraftAcs;
  certificate: DpeContentDraftCertificate;
  draftReferenceItems?: DpeDraftReferenceItem[];
  promptInstructions?: string;
  sourceText: string;
};

export type DpeContentStudioDraft = {
  acs: DpeContentDraftAcs;
  answerKey: {
    acceptableVariations: string[];
    commonMisses: string[];
    correctAnswerElements: string[];
    notes?: string;
    sourceReferences: string[];
    status: "draft";
  };
  certificate: DpeContentDraftCertificate;
  confidence: number;
  generation: {
    mode: "ai" | "fallback";
    model: string | null;
    saved: false;
  };
  draftReferenceContract: DpeDraftReferenceContract;
  oralQuestion: {
    acsElementType?: string;
    primarySubject?: string;
    questionMode: "oral";
    questionText: string;
  };
  readiness: {
    hasAcsReference: boolean;
    hasAcsTask: boolean;
    hasAnswerKey: boolean;
    hasCertificate: boolean;
    hasQuestion: boolean;
    hasRubric: boolean;
    missingFields: string[];
    readyToReview: boolean;
  };
  rubric: {
    checkrideReadiness: string;
    communication: string;
    knowledge: string;
    riskManagement: string;
    scenarioJudgment: string;
    scoringNotes?: string;
    status: "draft";
  };
  sourceSummary: string;
  warnings: string[];
};

type RawDraft = {
  acs?: Partial<DpeContentDraftAcs>;
  answerKey?: Partial<DpeContentStudioDraft["answerKey"]>;
  certificate?: Partial<DpeContentDraftCertificate>;
  confidence?: unknown;
  oralQuestion?: Partial<DpeContentStudioDraft["oralQuestion"]>;
  rubric?: Partial<DpeContentStudioDraft["rubric"]>;
  sourceSummary?: unknown;
  warnings?: unknown;
};

const GENERATE_MODEL = process.env.OPENAI_DPE_CONTENT_MODEL ?? "gpt-4o";
const MAX_SOURCE_CHARS = 24_000;
const MAX_INSTRUCTION_CHARS = 2_000;
const MAX_CONTEXT_CHARS = 200;

function clean(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanOptional(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanList(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const list = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);

  return list.length > 0 ? list : fallback;
}

function clampConfidence(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.55;
  }

  return Math.min(0.95, Math.max(0.1, value));
}

function truncate(value: string | undefined, maxLength = MAX_CONTEXT_CHARS) {
  return value?.trim().slice(0, maxLength) || undefined;
}

function normalizeCertificate(value: unknown): DpeContentDraftCertificate {
  if (typeof value === "string") {
    const text = truncate(value);
    return text ? { id: text, title: text } : {};
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const candidate = value as Record<string, unknown>;
  return {
    code: truncate(cleanOptional(candidate.code), 80),
    id: truncate(cleanOptional(candidate.id), 120),
    title: truncate(cleanOptional(candidate.title), 200),
  };
}

function normalizeAcs(value: unknown): DpeContentDraftAcs {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const candidate = value as Record<string, unknown>;
  return {
    area: truncate(cleanOptional(candidate.area ?? candidate.acsArea), 40),
    elementType: truncate(cleanOptional(candidate.elementType ?? candidate.acsElementType), 80),
    reference: truncate(cleanOptional(candidate.reference ?? candidate.acsElementReference), 120),
    task: truncate(cleanOptional(candidate.task ?? candidate.acsTask), 40),
    title: truncate(cleanOptional(candidate.title ?? candidate.acsTitle), 200),
  };
}

function definedCertificate(value: unknown): DpeContentDraftCertificate {
  const certificate = normalizeCertificate(value);

  return Object.fromEntries(
    Object.entries(certificate).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ) as DpeContentDraftCertificate;
}

function definedAcs(value: unknown): DpeContentDraftAcs {
  const acs = normalizeAcs(value);

  return Object.fromEntries(
    Object.entries(acs).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ) as DpeContentDraftAcs;
}

export function parseDpeContentDraftInput(body: unknown): { error: string; ok: false } | {
  ok: true;
  value: DpeContentDraftInput;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Draft generation payload must be an object.", ok: false };
  }

  const candidate = body as Record<string, unknown>;
  const sourceText = clean(candidate.sourceText);
  if (!sourceText) {
    return { error: "Source text is required.", ok: false };
  }
  if (sourceText.length < 40) {
    return { error: "Source text must be at least 40 characters.", ok: false };
  }

  const certificate = normalizeCertificate(
    candidate.certificate ?? {
      code: candidate.certificateCode,
      id: candidate.certificateTypeId ?? candidate.certificateId,
      title: candidate.certificateTitle,
    },
  );
  if (!certificate.id && !certificate.code && !certificate.title) {
    return { error: "Certificate context is required.", ok: false };
  }

  const acs = normalizeAcs(
    candidate.acs ?? {
      acsArea: candidate.acsArea,
      acsElementReference: candidate.acsElementReference,
      acsElementType: candidate.acsElementType,
      acsTask: candidate.acsTask,
      acsTitle: candidate.acsTitle,
    },
  );
  const parsedDraftReferences = parseDpeDraftReferenceItems(
    candidate.dpeDraftReferenceItems ??
      candidate.draftReferenceItems ??
      candidate.sourcePackDraftReferences,
  );
  if ("error" in parsedDraftReferences) {
    return { error: parsedDraftReferences.error, ok: false };
  }

  return {
    ok: true,
    value: {
      acs,
      certificate,
      draftReferenceItems: parsedDraftReferences.items,
      promptInstructions: truncate(cleanOptional(candidate.promptInstructions), MAX_INSTRUCTION_CHARS),
      sourceText: sourceText.slice(0, MAX_SOURCE_CHARS),
    },
  };
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

function sourceSentences(sourceText: string) {
  return sourceText
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((item) => item.length >= 24)
    .slice(0, 8);
}

function missingFields(args: {
  acs: DpeContentDraftAcs;
  answerKeyElements: string[];
  certificate: DpeContentDraftCertificate;
  questionText: string;
  rubric: DpeContentStudioDraft["rubric"];
}) {
  const missing: string[] = [];

  if (!args.certificate.id && !args.certificate.code && !args.certificate.title) missing.push("certificate");
  if (!args.acs.task) missing.push("acs.task");
  if (!args.acs.reference) missing.push("acs.reference");
  if (!args.questionText) missing.push("oralQuestion.questionText");
  if (args.answerKeyElements.length === 0) missing.push("answerKey.correctAnswerElements");
  if (
    !args.rubric.knowledge ||
    !args.rubric.riskManagement ||
    !args.rubric.scenarioJudgment ||
    !args.rubric.communication ||
    !args.rubric.checkrideReadiness
  ) {
    missing.push("rubric");
  }

  return missing;
}

function buildReadiness(args: {
  acs: DpeContentDraftAcs;
  answerKeyElements: string[];
  certificate: DpeContentDraftCertificate;
  questionText: string;
  rubric: DpeContentStudioDraft["rubric"];
}) {
  const missing = missingFields(args);

  return {
    hasAcsReference: Boolean(args.acs.reference),
    hasAcsTask: Boolean(args.acs.task),
    hasAnswerKey: args.answerKeyElements.length > 0,
    hasCertificate: Boolean(args.certificate.id || args.certificate.code || args.certificate.title),
    hasQuestion: Boolean(args.questionText),
    hasRubric: !missing.includes("rubric"),
    missingFields: missing,
    readyToReview: missing.length === 0,
  };
}

function fallbackDraft(args: {
  acs: DpeContentDraftAcs;
  certificate: DpeContentDraftCertificate;
  draftReferenceItems?: DpeDraftReferenceItem[];
  promptInstructions?: string;
  sourceText: string;
  warnings?: string[];
}): DpeContentStudioDraft {
  const sentences = sourceSentences(args.sourceText);
  const answerElements = (sentences.length > 0 ? sentences : [args.sourceText.slice(0, 360)]).slice(0, 5);
  const subject = args.acs.reference ?? args.acs.task ?? args.acs.area ?? "this ACS topic";
  const questionText = [
    `Explain ${subject} using the provided source material,`,
    "and describe how you would apply it during a practical test scenario.",
  ].join(" ");
  const rubric = {
    checkrideReadiness: "The response is organized, accurate, and conservative enough for oral checkride standards.",
    communication: "The response is concise, structured, and uses pilot-in-command language.",
    knowledge: "The response covers the source-grounded facts and explains why they matter.",
    riskManagement: "The response identifies safety implications, limits, and mitigation steps.",
    scenarioJudgment: "The response applies the knowledge to a practical flight or checkride scenario.",
    scoringNotes: [
      "Deterministic draft generated for admin review;",
      "verify against FAA source material before publishing.",
    ].join(" "),
    status: "draft" as const,
  };
  const readiness = buildReadiness({
    acs: args.acs,
    answerKeyElements: answerElements,
    certificate: args.certificate,
    questionText,
    rubric,
  });

  return {
    acs: args.acs,
    answerKey: {
      acceptableVariations: [
        "Equivalent FAA terminology is acceptable when the safety outcome and limits are clear.",
        "Scenario-specific examples are acceptable when they remain consistent with the source.",
      ],
      commonMisses: [
        "Reciting a definition without explaining operational impact.",
        "Skipping risk management or practical test application.",
      ],
      correctAnswerElements: answerElements,
      notes: args.promptInstructions,
      sourceReferences: ["Provided source text"],
      status: "draft",
    },
    certificate: args.certificate,
    confidence: 0.45,
    generation: {
      mode: "fallback",
      model: null,
      saved: false,
    },
    draftReferenceContract: buildDpeDraftReferenceContract(args.draftReferenceItems),
    oralQuestion: {
      acsElementType: args.acs.elementType,
      primarySubject: subject,
      questionMode: "oral",
      questionText,
    },
    readiness,
    rubric,
    sourceSummary: args.sourceText.slice(0, 500),
    warnings: [
      ...(args.warnings ?? []),
      "This is a deterministic fallback draft and must be reviewed before publishing.",
      ...readiness.missingFields.map((field) => `${field} is missing or incomplete.`),
    ],
  };
}

function normalizeDraft(raw: RawDraft, args: {
  acs: DpeContentDraftAcs;
  certificate: DpeContentDraftCertificate;
  draftReferenceItems?: DpeDraftReferenceItem[];
  sourceText: string;
}): DpeContentStudioDraft {
  const fallback = fallbackDraft({
    acs: args.acs,
    certificate: args.certificate,
    draftReferenceItems: args.draftReferenceItems,
    sourceText: args.sourceText,
  });
  const acs = {
    ...args.acs,
    ...definedAcs(raw.acs),
  };
  const certificate = {
    ...args.certificate,
    ...definedCertificate(raw.certificate),
  };
  const answerKeyElements = cleanList(raw.answerKey?.correctAnswerElements, fallback.answerKey.correctAnswerElements);
  const rubric = {
    checkrideReadiness: clean(raw.rubric?.checkrideReadiness, fallback.rubric.checkrideReadiness),
    communication: clean(raw.rubric?.communication, fallback.rubric.communication),
    knowledge: clean(raw.rubric?.knowledge, fallback.rubric.knowledge),
    riskManagement: clean(raw.rubric?.riskManagement, fallback.rubric.riskManagement),
    scenarioJudgment: clean(raw.rubric?.scenarioJudgment, fallback.rubric.scenarioJudgment),
    scoringNotes: cleanOptional(raw.rubric?.scoringNotes) ?? fallback.rubric.scoringNotes,
    status: "draft" as const,
  };
  const questionText = clean(raw.oralQuestion?.questionText, fallback.oralQuestion.questionText);
  const readiness = buildReadiness({
    acs,
    answerKeyElements,
    certificate,
    questionText,
    rubric,
  });

  return {
    acs,
    answerKey: {
      acceptableVariations: cleanList(raw.answerKey?.acceptableVariations, fallback.answerKey.acceptableVariations),
      commonMisses: cleanList(raw.answerKey?.commonMisses, fallback.answerKey.commonMisses),
      correctAnswerElements: answerKeyElements,
      notes: cleanOptional(raw.answerKey?.notes),
      sourceReferences: cleanList(raw.answerKey?.sourceReferences, fallback.answerKey.sourceReferences),
      status: "draft",
    },
    certificate,
    confidence: clampConfidence(raw.confidence),
    generation: {
      mode: "ai",
      model: GENERATE_MODEL,
      saved: false,
    },
    draftReferenceContract: buildDpeDraftReferenceContract(args.draftReferenceItems),
    oralQuestion: {
      acsElementType: cleanOptional(raw.oralQuestion?.acsElementType) ?? acs.elementType,
      primarySubject: cleanOptional(raw.oralQuestion?.primarySubject),
      questionMode: "oral",
      questionText,
    },
    readiness,
    rubric,
    sourceSummary: clean(raw.sourceSummary, args.sourceText.slice(0, 500)),
    warnings: [
      ...cleanList(raw.warnings),
      "Generation creates a draft only. Saving or publishing to DPE content tables requires a separate admin action.",
      ...readiness.missingFields.map((field) => `${field} is missing or incomplete.`),
    ],
  };
}

function buildPrompt(args: DpeContentDraftInput) {
  return `Create a reviewable QuesIQ DPE Content Studio draft from the source text.

This is a controlled DPE generation step only. Do not claim the content is published, ready, official, or saved.
Return a draft for admin review using this flow:
certificate -> ACS area/task -> oral question -> answer key -> rubric -> readiness.

Return only JSON with this exact shape:
{
  "certificate": {
    "id": "certificate id if known",
    "code": "certificate code if known",
    "title": "certificate title"
  },
  "acs": {
    "title": "ACS title",
    "area": "ACS area",
    "task": "ACS task",
    "reference": "ACS element/reference",
    "elementType": "Knowledge/Risk Management/Skill if known"
  },
  "oralQuestion": {
    "questionText": "One oral exam question",
    "questionMode": "oral",
    "acsElementType": "Element type",
    "primarySubject": "Short subject"
  },
  "answerKey": {
    "correctAnswerElements": ["Required element"],
    "acceptableVariations": ["Equivalent acceptable phrasing"],
    "commonMisses": ["Common incomplete or unsafe answer"],
    "sourceReferences": ["Source citation, ACS reference, or 'Provided source text'"],
    "notes": "Optional admin review note",
    "status": "draft"
  },
  "rubric": {
    "knowledge": "How to score knowledge",
    "riskManagement": "How to score risk management",
    "scenarioJudgment": "How to score scenario judgment",
    "communication": "How to score communication",
    "checkrideReadiness": "How to score readiness",
    "scoringNotes": "Optional notes",
    "status": "draft"
  },
  "sourceSummary": "Brief source summary",
  "confidence": 0.0,
  "warnings": ["Any missing context, uncertainty, or admin review needs"]
}

Guidelines:
- Generate one oral question only.
- Keep the answer key source-grounded and suitable for a FAA practical test oral answer.
- Include concrete common misses and acceptable variations.
- Keep rubric dimensions deterministic and admin-reviewable.
- Set confidence for source grounding only, not official readiness.
- Add warnings for missing ACS reference, thin source text, ambiguity, or safety-sensitive uncertainty.
- Do not invent a certificate, ACS task, or ACS reference when the provided context is missing; leave it blank and warn.

Certificate context:
${JSON.stringify(args.certificate)}

ACS hints:
${JSON.stringify(args.acs)}

Prompt instructions:
${args.promptInstructions || "None"}

Source text:
${args.sourceText.slice(0, MAX_SOURCE_CHARS)}`;
}

export async function generateDpeContentStudioDraft(args: DpeContentDraftInput & {
  userId?: string;
}): Promise<DpeContentStudioDraft> {
  const sourceText = args.sourceText.trim().slice(0, MAX_SOURCE_CHARS);
  const promptInstructions = args.promptInstructions?.trim().slice(0, MAX_INSTRUCTION_CHARS) || undefined;

  if (sourceText.length < 40) {
    throw new Error("Source text must be at least 40 characters.");
  }

  const fallbackArgs = {
    acs: args.acs ?? {},
    certificate: args.certificate,
    draftReferenceItems: args.draftReferenceItems ?? [],
    promptInstructions,
    sourceText,
  };
  const apiKey = getOpenAiApiKey("dpe");

  if (!apiKey) {
    return fallbackDraft({
      ...fallbackArgs,
      warnings: ["OpenAI is not configured, so this draft was generated without AI."],
    });
  }

  const prompt = buildPrompt({ ...fallbackArgs, promptInstructions });
  const aiRun = await startAiRun({
    model: GENERATE_MODEL,
    promptSnapshot: prompt,
    rawJson: {
      acs: fallbackArgs.acs,
      certificate: fallbackArgs.certificate,
      operation: "dpe_content_studio_draft",
      promptInstructionsLength: promptInstructions?.length ?? 0,
      sourcePackDraftReferenceCount: fallbackArgs.draftReferenceItems.length,
      sourcePackIds: buildDpeDraftReferenceContract(fallbackArgs.draftReferenceItems).sourcePackIds,
      sourceTextLength: sourceText.length,
    },
    runType: "dpe_review",
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
      throw new Error(payload.error?.message || "DPE content draft generation failed.");
    }

    const raw = payload.choices?.[0]?.message?.content ?? "{}";
    const draft = normalizeDraft(JSON.parse(extractJsonObject(raw)) as RawDraft, {
      acs: fallbackArgs.acs,
      certificate: fallbackArgs.certificate,
      draftReferenceItems: fallbackArgs.draftReferenceItems,
      sourceText,
    });

    await completeAiRun(aiRun.id, {
      costSource: payload.usage ? "exact" : "unavailable",
      inputTokens: payload.usage?.prompt_tokens,
      outputTokens: payload.usage?.completion_tokens,
      providerRequestId: payload.id,
      rawJson: {
        confidence: draft.confidence,
        missingFields: draft.readiness.missingFields,
        operation: "dpe_content_studio_draft",
        readyToReview: draft.readiness.readyToReview,
        usage: payload.usage,
      },
      status: "succeeded",
      totalTokens: payload.usage?.total_tokens,
    });

    return draft;
  } catch (error) {
    const message = error instanceof Error ? error.message : "DPE content draft generation failed.";

    await completeAiRun(aiRun.id, {
      errorMessage: message,
      status: "failed",
    });

    return fallbackDraft({
      ...fallbackArgs,
      warnings: [
        `AI generation failed: ${message}`,
        "A deterministic fallback draft was returned so admin review can continue.",
      ],
    });
  }
}
