import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  dpeCertificateTypes,
  dpeContentVersions,
  dpeOralQuestions,
  dpeQuestionAnswerKeys,
  dpeQuestionRubrics,
} from "@/server/db/schema";

const allowedContentStatuses = new Set(["draft", "review", "ready", "placeholder"]);
const maxTextLength = 6000;

export type DpeContentValidationResult<T> =
  | { ok: true; value: T }
  | { error: string; ok: false };

export type DpeQuestionDraft = {
  acsArea: string;
  acsElementReference: string;
  acsElementType: string;
  acsTask: string;
  acsTitle: string;
  active?: boolean;
  aiContext?: Record<string, unknown> | string | null;
  certificateTypeId: string;
  contentVersionId?: string | null;
  difficulty?: string | null;
  id?: string;
  keywords?: string | null;
  primarySubject?: string | null;
  questionMode?: string;
  questionText: string;
  visualImage?: string | null;
};

export type DpeAnswerKeyDraft = {
  acceptableVariations?: string[];
  commonMisses?: string[];
  correctAnswerElements: string[];
  notes?: string | null;
  sourceReferences?: string[];
  status?: string;
};

export type DpeRubricDraft = {
  checkrideReadiness: string;
  communication: string;
  knowledge: string;
  riskManagement: string;
  scenarioJudgment: string;
  scoringNotes?: string | null;
  status?: string;
};

function cleanText(value: unknown, field: string, maxLength = maxTextLength) {
  if (typeof value !== "string") {
    return { error: `${field} is required.`, ok: false as const };
  }

  const text = value.trim();

  if (!text) {
    return { error: `${field} is required.`, ok: false as const };
  }

  if (text.length > maxLength) {
    return { error: `${field} must be ${maxLength} characters or fewer.`, ok: false as const };
  }

  return { ok: true as const, value: text };
}

function cleanOptionalText(value: unknown, field: string, maxLength = maxTextLength) {
  if (value === undefined || value === null) {
    return { ok: true as const, value: null };
  }

  if (typeof value !== "string") {
    return { error: `${field} must be text.`, ok: false as const };
  }

  const text = value.trim();

  if (!text) {
    return { ok: true as const, value: null };
  }

  if (text.length > maxLength) {
    return { error: `${field} must be ${maxLength} characters or fewer.`, ok: false as const };
  }

  return { ok: true as const, value: text };
}

function cleanStringList(value: unknown, field: string, required = false) {
  if (value === undefined || value === null) {
    return required
      ? { error: `${field} is required.`, ok: false as const }
      : { ok: true as const, value: [] };
  }

  if (!Array.isArray(value)) {
    return { error: `${field} must be a list.`, ok: false as const };
  }

  const list = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);

  if (required && list.length === 0) {
    return { error: `${field} needs at least one item.`, ok: false as const };
  }

  return { ok: true as const, value: list };
}

function cleanStatus(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return { ok: true as const, value: "draft" };
  }

  if (typeof value !== "string" || !allowedContentStatuses.has(value)) {
    return {
      error: `status must be one of ${Array.from(allowedContentStatuses).join(", ")}.`,
      ok: false as const,
    };
  }

  return { ok: true as const, value };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function maybeAiContext(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return JSON.stringify(value);
  }

  return null;
}

export function parseDpeQuestionDraft(body: unknown): DpeContentValidationResult<DpeQuestionDraft> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Question payload must be an object.", ok: false };
  }

  const candidate = body as Record<string, unknown>;
  const acsArea = cleanText(candidate.acsArea, "acsArea", 20);
  if (!acsArea.ok) return acsArea;
  const acsElementReference = cleanText(candidate.acsElementReference, "acsElementReference", 80);
  if (!acsElementReference.ok) return acsElementReference;
  const acsElementType = cleanText(candidate.acsElementType, "acsElementType", 80);
  if (!acsElementType.ok) return acsElementType;
  const acsTask = cleanText(candidate.acsTask, "acsTask", 20);
  if (!acsTask.ok) return acsTask;
  const acsTitle = cleanText(candidate.acsTitle, "acsTitle", 200);
  if (!acsTitle.ok) return acsTitle;
  const certificateTypeId = cleanText(candidate.certificateTypeId, "certificateTypeId", 120);
  if (!certificateTypeId.ok) return certificateTypeId;
  const questionText = cleanText(candidate.questionText, "questionText");
  if (!questionText.ok) return questionText;
  const contentVersionId = cleanOptionalText(candidate.contentVersionId, "contentVersionId", 80);
  if (!contentVersionId.ok) return contentVersionId;
  const difficulty = cleanOptionalText(candidate.difficulty, "difficulty", 80);
  if (!difficulty.ok) return difficulty;
  const id = cleanOptionalText(candidate.id, "id", 160);
  if (!id.ok) return id;
  const keywords = cleanOptionalText(candidate.keywords, "keywords", 500);
  if (!keywords.ok) return keywords;
  const primarySubject = cleanOptionalText(candidate.primarySubject, "primarySubject", 200);
  if (!primarySubject.ok) return primarySubject;
  const questionMode = cleanOptionalText(candidate.questionMode, "questionMode", 80);
  if (!questionMode.ok) return questionMode;
  const visualImage = cleanOptionalText(candidate.visualImage, "visualImage", 1000);
  if (!visualImage.ok) return visualImage;

  return {
    ok: true,
    value: {
      acsArea: acsArea.value,
      acsElementReference: acsElementReference.value,
      acsElementType: acsElementType.value,
      acsTask: acsTask.value,
      acsTitle: acsTitle.value,
      active: typeof candidate.active === "boolean" ? candidate.active : true,
      aiContext: maybeAiContext(candidate.aiContext),
      certificateTypeId: certificateTypeId.value,
      contentVersionId: contentVersionId.value,
      difficulty: difficulty.value,
      id: id.value ?? undefined,
      keywords: keywords.value,
      primarySubject: primarySubject.value,
      questionMode: questionMode.value ?? "oral",
      questionText: questionText.value,
      visualImage: visualImage.value,
    },
  };
}

export function parseDpeAnswerKeyDraft(body: unknown): DpeContentValidationResult<DpeAnswerKeyDraft> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Answer key payload must be an object.", ok: false };
  }

  const candidate = body as Record<string, unknown>;
  const correctAnswerElements = cleanStringList(candidate.correctAnswerElements, "correctAnswerElements", true);
  const acceptableVariations = cleanStringList(candidate.acceptableVariations, "acceptableVariations");
  const commonMisses = cleanStringList(candidate.commonMisses, "commonMisses");
  const sourceReferences = cleanStringList(candidate.sourceReferences, "sourceReferences");
  const notes = cleanOptionalText(candidate.notes, "notes");
  const status = cleanStatus(candidate.status);

  if (!correctAnswerElements.ok) return correctAnswerElements;
  if (!acceptableVariations.ok) return acceptableVariations;
  if (!commonMisses.ok) return commonMisses;
  if (!sourceReferences.ok) return sourceReferences;
  if (!notes.ok) return notes;
  if (!status.ok) return status;

  return {
    ok: true,
    value: {
      acceptableVariations: acceptableVariations.value,
      commonMisses: commonMisses.value,
      correctAnswerElements: correctAnswerElements.value,
      notes: notes.value,
      sourceReferences: sourceReferences.value,
      status: status.value,
    },
  };
}

export function parseDpeRubricDraft(body: unknown): DpeContentValidationResult<DpeRubricDraft> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Rubric payload must be an object.", ok: false };
  }

  const candidate = body as Record<string, unknown>;
  const checkrideReadiness = cleanText(candidate.checkrideReadiness, "checkrideReadiness");
  const communication = cleanText(candidate.communication, "communication");
  const knowledge = cleanText(candidate.knowledge, "knowledge");
  const riskManagement = cleanText(candidate.riskManagement, "riskManagement");
  const scenarioJudgment = cleanText(candidate.scenarioJudgment, "scenarioJudgment");
  const scoringNotes = cleanOptionalText(candidate.scoringNotes, "scoringNotes");
  const status = cleanStatus(candidate.status);

  if (!checkrideReadiness.ok) return checkrideReadiness;
  if (!communication.ok) return communication;
  if (!knowledge.ok) return knowledge;
  if (!riskManagement.ok) return riskManagement;
  if (!scenarioJudgment.ok) return scenarioJudgment;
  if (!scoringNotes.ok) return scoringNotes;
  if (!status.ok) return status;

  return {
    ok: true,
    value: {
      checkrideReadiness: checkrideReadiness.value,
      communication: communication.value,
      knowledge: knowledge.value,
      riskManagement: riskManagement.value,
      scenarioJudgment: scenarioJudgment.value,
      scoringNotes: scoringNotes.value,
      status: status.value,
    },
  };
}

async function getLatestContentVersionId(certificateTypeId: string) {
  const [version] = await getDb()
    .select({ id: dpeContentVersions.id })
    .from(dpeContentVersions)
    .where(eq(dpeContentVersions.certificateTypeId, certificateTypeId))
    .orderBy(desc(dpeContentVersions.version))
    .limit(1);

  return version?.id ?? null;
}

async function assertCertificateAndVersion(input: {
  certificateTypeId: string;
  contentVersionId?: string | null;
}) {
  const [certificate] = await getDb()
    .select({ id: dpeCertificateTypes.id })
    .from(dpeCertificateTypes)
    .where(eq(dpeCertificateTypes.id, input.certificateTypeId))
    .limit(1);

  if (!certificate) {
    throw new Error("DPE certificate type was not found.");
  }

  if (!input.contentVersionId) {
    return getLatestContentVersionId(input.certificateTypeId);
  }

  const [version] = await getDb()
    .select({ id: dpeContentVersions.id })
    .from(dpeContentVersions)
    .where(
      and(
        eq(dpeContentVersions.id, input.contentVersionId),
        eq(dpeContentVersions.certificateTypeId, input.certificateTypeId),
      ),
    )
    .limit(1);

  if (!version) {
    throw new Error("DPE content version does not belong to the selected certificate.");
  }

  return version.id;
}

async function assertQuestionExists(questionId: string) {
  const [question] = await getDb()
    .select({
      certificateTypeId: dpeOralQuestions.certificateTypeId,
      id: dpeOralQuestions.id,
    })
    .from(dpeOralQuestions)
    .where(eq(dpeOralQuestions.id, questionId))
    .limit(1);

  if (!question) {
    throw new Error("DPE oral question was not found.");
  }

  return question;
}

function questionIdFromDraft(input: DpeQuestionDraft) {
  return (
    input.id ??
    [
      "dpe",
      slugify(input.certificateTypeId),
      slugify(input.acsArea),
      slugify(input.acsTask),
      slugify(input.acsElementReference),
      randomUUID().slice(0, 8),
    ]
      .filter(Boolean)
      .join("-")
  );
}

export async function upsertDpeOralQuestion(input: DpeQuestionDraft) {
  const now = new Date();
  const contentVersionId = await assertCertificateAndVersion(input);
  const id = questionIdFromDraft(input);
  const values = {
    acsArea: input.acsArea,
    acsElementReference: input.acsElementReference,
    acsElementType: input.acsElementType,
    acsTask: input.acsTask,
    acsTitle: input.acsTitle,
    active: input.active ?? true,
    aiContext: typeof input.aiContext === "string" ? input.aiContext : maybeAiContext(input.aiContext),
    certificateTypeId: input.certificateTypeId,
    contentVersionId,
    difficulty: input.difficulty,
    id,
    keywords: input.keywords,
    primarySubject: input.primarySubject,
    questionMode: input.questionMode ?? "oral",
    questionText: input.questionText,
    updatedAt: now,
    visualImage: input.visualImage,
  };
  const [question] = await getDb()
    .insert(dpeOralQuestions)
    .values(values)
    .onConflictDoUpdate({
      set: values,
      target: dpeOralQuestions.id,
    })
    .returning();

  return question;
}

export async function upsertDpeAnswerKey(questionId: string, input: DpeAnswerKeyDraft) {
  await assertQuestionExists(questionId);

  const now = new Date();
  const values = {
    acceptableVariations: input.acceptableVariations,
    commonMisses: input.commonMisses,
    correctAnswerElements: input.correctAnswerElements,
    notes: input.notes,
    questionId,
    sourceReferences: input.sourceReferences,
    status: input.status ?? "draft",
    updatedAt: now,
  };
  const [answerKey] = await getDb()
    .insert(dpeQuestionAnswerKeys)
    .values(values)
    .onConflictDoUpdate({
      set: values,
      target: dpeQuestionAnswerKeys.questionId,
    })
    .returning();

  return answerKey;
}

export async function upsertDpeRubric(questionId: string, input: DpeRubricDraft) {
  await assertQuestionExists(questionId);

  const now = new Date();
  const values = {
    checkrideReadiness: input.checkrideReadiness,
    communication: input.communication,
    knowledge: input.knowledge,
    questionId,
    riskManagement: input.riskManagement,
    scenarioJudgment: input.scenarioJudgment,
    scoringNotes: input.scoringNotes,
    status: input.status ?? "draft",
    updatedAt: now,
  };
  const [rubric] = await getDb()
    .insert(dpeQuestionRubrics)
    .values(values)
    .onConflictDoUpdate({
      set: values,
      target: dpeQuestionRubrics.questionId,
    })
    .returning();

  return rubric;
}
