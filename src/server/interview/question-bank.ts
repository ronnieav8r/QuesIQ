import { and, asc, eq, or } from "drizzle-orm";

import type {
  InterviewQuestionDifficulty,
  InterviewQuestionRecord,
  PracticeModeKey,
  QuestionTypeKey,
  SelectedQuestionContext,
} from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import {
  evaluations,
  interviewQuestionImports,
  interviewQuestionPracticeAttempts,
  interviewQuestions,
  sessions,
} from "@/server/db/schema";

export const INTERVIEW_QUESTION_CSV_HEADERS = [
  "externalId",
  "questionText",
  "questionTypeKey",
  "targetSkill",
  "difficulty",
  "roleFamily",
  "tags",
  "compatibleModes",
  "suggestedUse",
  "scoringHints",
  "displayOrder",
  "enabled",
  "sourceLabel",
] as const;

type QuestionFilters = {
  difficulty?: string;
  questionTypeKey?: string;
  roleFamily?: string;
  search?: string;
  tag?: string;
  targetSkill?: string;
};

type QuestionInput = {
  compatibleModes?: string[];
  difficulty?: string;
  enabled?: boolean;
  questionText?: string;
  questionTypeKey?: string;
  roleFamily?: string;
  scoringHints?: string;
  suggestedUse?: string;
  tags?: string[];
  targetSkill?: string;
};

type CsvError = {
  message: string;
  row: number;
  severity: "error" | "warning";
};

type ImportQuestionRow = {
  compatibleModes: PracticeModeKey[];
  difficulty: InterviewQuestionDifficulty;
  displayOrder: number;
  enabled: boolean;
  externalId: string;
  questionText: string;
  questionTypeKey?: QuestionTypeKey;
  roleFamily: string;
  scoringHints: string;
  sourceLabel: string;
  suggestedUse: string;
  tags: string[];
  targetSkill: string;
};

const questionTypeKeys: QuestionTypeKey[] = [
  "behavioral",
  "technical",
  "hypothetical",
  "motivational",
];
const difficultyValues: InterviewQuestionDifficulty[] = ["beginner", "standard", "advanced"];
const modeKeys: PracticeModeKey[] = [
  "coaching",
  "first_impression",
  "mock_interview",
  "rapid_fire",
];

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanString(item)).filter(Boolean);
  }

  return cleanString(value)
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanQuestionType(value: unknown) {
  const cleaned = cleanString(value);
  return questionTypeKeys.includes(cleaned as QuestionTypeKey)
    ? (cleaned as QuestionTypeKey)
    : undefined;
}

function cleanDifficulty(value: unknown): InterviewQuestionDifficulty {
  const cleaned = cleanString(value);
  return difficultyValues.includes(cleaned as InterviewQuestionDifficulty)
    ? (cleaned as InterviewQuestionDifficulty)
    : "standard";
}

function cleanCompatibleModes(value: unknown): PracticeModeKey[] {
  const cleaned = cleanStringList(value).filter((mode) =>
    modeKeys.includes(mode as PracticeModeKey),
  ) as PracticeModeKey[];

  return cleaned.length > 0 ? cleaned : ["coaching"];
}

function cleanBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }

  const cleaned = cleanString(value).toLowerCase();
  if (["1", "true", "yes", "y", "enabled"].includes(cleaned)) {
    return true;
  }
  if (["0", "false", "no", "n", "disabled"].includes(cleaned)) {
    return false;
  }

  return fallback;
}

function toQuestionRecord(row: typeof interviewQuestions.$inferSelect): InterviewQuestionRecord {
  return {
    compatibleModes: row.compatibleModes,
    createdAt: row.createdAt.toISOString(),
    difficulty: row.difficulty,
    displayOrder: row.displayOrder,
    enabled: row.enabled,
    externalId: row.externalId ?? undefined,
    id: row.id,
    ownerUserId: row.ownerUserId ?? undefined,
    questionText: row.questionText,
    questionTypeKey: row.questionTypeKey ?? undefined,
    roleFamily: row.roleFamily,
    scoringHints: row.scoringHints,
    source: row.source,
    sourceLabel: row.sourceLabel,
    suggestedUse: row.suggestedUse,
    tags: row.tags,
    targetSkill: row.targetSkill,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSelectedQuestionContext(
  question: InterviewQuestionRecord,
): SelectedQuestionContext {
  return {
    difficulty: question.difficulty,
    id: question.id,
    questionText: question.questionText,
    questionTypeKey: question.questionTypeKey,
    roleFamily: question.roleFamily,
    source: question.source,
    sourceLabel: question.sourceLabel,
    suggestedUse: question.suggestedUse,
    targetSkill: question.targetSkill,
  };
}

export async function listInterviewQuestions(userId: string, filters: QuestionFilters = {}) {
  const rows = await getDb()
    .select()
    .from(interviewQuestions)
    .where(
      and(
        eq(interviewQuestions.enabled, true),
        or(eq(interviewQuestions.source, "official"), eq(interviewQuestions.ownerUserId, userId)),
      ),
    )
    .orderBy(asc(interviewQuestions.displayOrder), asc(interviewQuestions.createdAt));

  const search = cleanString(filters.search).toLowerCase();
  const tag = cleanString(filters.tag).toLowerCase();
  const questionTypeKey = cleanString(filters.questionTypeKey);
  const targetSkill = cleanString(filters.targetSkill).toLowerCase();
  const roleFamily = cleanString(filters.roleFamily).toLowerCase();
  const difficulty = cleanString(filters.difficulty);

  return rows.map(toQuestionRecord).filter((question) => {
    if (questionTypeKey && question.questionTypeKey !== questionTypeKey) return false;
    if (difficulty && question.difficulty !== difficulty) return false;
    if (targetSkill && !question.targetSkill.toLowerCase().includes(targetSkill)) return false;
    if (roleFamily && !question.roleFamily.toLowerCase().includes(roleFamily)) return false;
    if (tag && !question.tags.some((item) => item.toLowerCase() === tag)) return false;
    if (search) {
      const haystack = [
        question.questionText,
        question.targetSkill,
        question.roleFamily,
        question.suggestedUse,
        question.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    }

    return true;
  });
}

export async function getAccessibleInterviewQuestion(questionId: string, userId: string) {
  const [row] = await getDb()
    .select()
    .from(interviewQuestions)
    .where(
      and(
        eq(interviewQuestions.id, questionId),
        eq(interviewQuestions.enabled, true),
        or(eq(interviewQuestions.source, "official"), eq(interviewQuestions.ownerUserId, userId)),
      ),
    )
    .limit(1);

  return row ? toQuestionRecord(row) : undefined;
}

export async function createCustomInterviewQuestion(userId: string, input: QuestionInput) {
  const questionText = cleanString(input.questionText);
  if (!questionText) {
    throw new Error("Question text is required.");
  }

  const [row] = await getDb()
    .insert(interviewQuestions)
    .values({
      compatibleModes: cleanCompatibleModes(input.compatibleModes),
      difficulty: cleanDifficulty(input.difficulty),
      enabled: true,
      ownerUserId: userId,
      questionText,
      questionTypeKey: cleanQuestionType(input.questionTypeKey),
      roleFamily: cleanString(input.roleFamily),
      scoringHints: cleanString(input.scoringHints),
      source: "custom",
      sourceLabel: "Private",
      suggestedUse: cleanString(input.suggestedUse),
      tags: cleanStringList(input.tags),
      targetSkill: cleanString(input.targetSkill),
      updatedAt: new Date(),
    })
    .returning();

  return toQuestionRecord(row);
}

export async function updateCustomInterviewQuestion(
  questionId: string,
  userId: string,
  input: QuestionInput,
) {
  const existing = await getAccessibleInterviewQuestion(questionId, userId);
  if (!existing || existing.source !== "custom" || existing.ownerUserId !== userId) {
    return undefined;
  }

  const questionText = cleanString(input.questionText) || existing.questionText;
  const [row] = await getDb()
    .update(interviewQuestions)
    .set({
      compatibleModes: input.compatibleModes
        ? cleanCompatibleModes(input.compatibleModes)
        : existing.compatibleModes,
      difficulty: input.difficulty ? cleanDifficulty(input.difficulty) : existing.difficulty,
      enabled: input.enabled === undefined ? existing.enabled : input.enabled,
      questionText,
      questionTypeKey:
        input.questionTypeKey === undefined
          ? existing.questionTypeKey
          : cleanQuestionType(input.questionTypeKey),
      roleFamily:
        input.roleFamily === undefined ? existing.roleFamily : cleanString(input.roleFamily),
      scoringHints:
        input.scoringHints === undefined
          ? existing.scoringHints
          : cleanString(input.scoringHints),
      suggestedUse:
        input.suggestedUse === undefined
          ? existing.suggestedUse
          : cleanString(input.suggestedUse),
      tags: input.tags ? cleanStringList(input.tags) : existing.tags,
      targetSkill:
        input.targetSkill === undefined
          ? existing.targetSkill
          : cleanString(input.targetSkill),
      updatedAt: new Date(),
    })
    .where(and(eq(interviewQuestions.id, questionId), eq(interviewQuestions.ownerUserId, userId)))
    .returning();

  return row ? toQuestionRecord(row) : undefined;
}

export async function disableCustomInterviewQuestion(questionId: string, userId: string) {
  const [row] = await getDb()
    .update(interviewQuestions)
    .set({ enabled: false, updatedAt: new Date() })
    .where(
      and(
        eq(interviewQuestions.id, questionId),
        eq(interviewQuestions.ownerUserId, userId),
        eq(interviewQuestions.source, "custom"),
      ),
    )
    .returning();

  return row ? toQuestionRecord(row) : undefined;
}

function parseCsvLike(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  row.push(cell);
  if (row.some((item) => item.trim())) rows.push(row);
  return rows;
}

export function parseInterviewQuestionImportText(csvText: string) {
  const errors: CsvError[] = [];
  const matrix = parseCsvLike(csvText.trim());
  if (matrix.length === 0) {
    return { detectedHeaders: [], errors: [{ message: "CSV text is empty.", row: 0, severity: "error" as const }], rowCount: 0, rows: [] as ImportQuestionRow[] };
  }

  const detectedHeaders = matrix[0].map((header) => header.trim());
  const headerIndex = new Map(detectedHeaders.map((header, index) => [header, index]));
  const rows: ImportQuestionRow[] = [];

  matrix.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2;
    const value = (header: string) => cleanString(cells[headerIndex.get(header) ?? -1]);
    const questionText = value("questionText");
    if (!questionText) {
      errors.push({ message: "questionText is required.", row: rowNumber, severity: "error" });
      return;
    }

    const questionTypeKey = cleanQuestionType(value("questionTypeKey"));
    if (value("questionTypeKey") && !questionTypeKey) {
      errors.push({
        message: "questionTypeKey must be behavioral, technical, hypothetical, or motivational.",
        row: rowNumber,
        severity: "error",
      });
    }

    const parsedDisplayOrder = Number(value("displayOrder"));
    rows.push({
      compatibleModes: cleanCompatibleModes(value("compatibleModes")),
      difficulty: cleanDifficulty(value("difficulty")),
      displayOrder: Number.isInteger(parsedDisplayOrder) ? parsedDisplayOrder : rowNumber * 10,
      enabled: cleanBoolean(value("enabled"), true),
      externalId: value("externalId") || `imported-question-${rowNumber}`,
      questionText,
      questionTypeKey,
      roleFamily: value("roleFamily"),
      scoringHints: value("scoringHints"),
      sourceLabel: value("sourceLabel") || "QuesIQ Official",
      suggestedUse: value("suggestedUse"),
      tags: cleanStringList(value("tags")),
      targetSkill: value("targetSkill"),
    });
  });

  return {
    detectedHeaders,
    errors,
    rowCount: rows.length,
    rows,
  };
}

export async function saveInterviewQuestionImport(input: {
  adminUserId: string;
  csvText: string;
  sourceLabel?: string;
}) {
  const parsed = parseInterviewQuestionImportText(input.csvText);
  if (parsed.errors.some((error) => error.severity === "error")) {
    throw new Error("CSV contains validation errors.");
  }

  let createdCount = 0;
  let updatedCount = 0;
  for (const row of parsed.rows) {
    const [existing] = await getDb()
      .select({ id: interviewQuestions.id })
      .from(interviewQuestions)
      .where(eq(interviewQuestions.externalId, row.externalId))
      .limit(1);

    await getDb()
      .insert(interviewQuestions)
      .values({
        compatibleModes: row.compatibleModes,
        difficulty: row.difficulty,
        displayOrder: row.displayOrder,
        enabled: row.enabled,
        externalId: row.externalId,
        questionText: row.questionText,
        questionTypeKey: row.questionTypeKey,
        roleFamily: row.roleFamily,
        scoringHints: row.scoringHints,
        source: "official",
        sourceLabel: input.sourceLabel?.trim() || row.sourceLabel,
        suggestedUse: row.suggestedUse,
        tags: row.tags,
        targetSkill: row.targetSkill,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        set: {
          compatibleModes: row.compatibleModes,
          difficulty: row.difficulty,
          displayOrder: row.displayOrder,
          enabled: row.enabled,
          questionText: row.questionText,
          questionTypeKey: row.questionTypeKey,
          roleFamily: row.roleFamily,
          scoringHints: row.scoringHints,
          sourceLabel: input.sourceLabel?.trim() || row.sourceLabel,
          suggestedUse: row.suggestedUse,
          tags: row.tags,
          targetSkill: row.targetSkill,
          updatedAt: new Date(),
        },
        target: interviewQuestions.externalId,
      });

    if (existing) updatedCount += 1;
    else createdCount += 1;
  }

  const [importRecord] = await getDb()
    .insert(interviewQuestionImports)
    .values({
      createdCount,
      errorCount: parsed.errors.length,
      rowCount: parsed.rowCount,
      sourceLabel: input.sourceLabel?.trim() || parsed.rows[0]?.sourceLabel || "QuesIQ Official",
      status: "saved",
      updatedAt: new Date(),
      updatedCount,
      userId: input.adminUserId,
    })
    .returning();

  return { createdCount, importId: importRecord.id, parsed, updatedCount };
}

export async function markQuestionAttemptStarted(input: {
  questionId: string;
  sessionId: string;
  userId: string;
}) {
  await getDb()
    .insert(interviewQuestionPracticeAttempts)
    .values({
      questionId: input.questionId,
      sessionId: input.sessionId,
      updatedAt: new Date(),
      userId: input.userId,
    })
    .onConflictDoNothing();
}

export async function markQuestionAttemptAnswered(input: {
  retryCount?: number;
  sessionId: string;
  userId: string;
}) {
  await getDb()
    .update(interviewQuestionPracticeAttempts)
    .set({
      retryCount: Math.max(0, input.retryCount ?? 0),
      status: "answered",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(interviewQuestionPracticeAttempts.sessionId, input.sessionId),
        eq(interviewQuestionPracticeAttempts.userId, input.userId),
      ),
    );
}

export async function markQuestionAttemptReviewed(sessionId: string, userId: string) {
  await getDb()
    .update(interviewQuestionPracticeAttempts)
    .set({ status: "reviewed", updatedAt: new Date() })
    .where(
      and(
        eq(interviewQuestionPracticeAttempts.sessionId, sessionId),
        eq(interviewQuestionPracticeAttempts.userId, userId),
      ),
    );
}

export async function listQuestionPracticeRecommendations(userId: string) {
  const rows = await getDb()
    .select({
      attemptStatus: interviewQuestionPracticeAttempts.status,
      evaluationResult: evaluations.result,
      question: interviewQuestions,
      sessionStatus: sessions.evaluationStatus,
      updatedAt: interviewQuestionPracticeAttempts.updatedAt,
    })
    .from(interviewQuestionPracticeAttempts)
    .innerJoin(interviewQuestions, eq(interviewQuestionPracticeAttempts.questionId, interviewQuestions.id))
    .innerJoin(sessions, eq(interviewQuestionPracticeAttempts.sessionId, sessions.id))
    .leftJoin(evaluations, eq(evaluations.sessionId, sessions.id))
    .where(eq(interviewQuestionPracticeAttempts.userId, userId))
    .orderBy(asc(interviewQuestionPracticeAttempts.updatedAt))
    .limit(50);

  return rows
    .filter((row) => {
      const average = row.evaluationResult?.scores?.length
        ? row.evaluationResult.scores.reduce((sum, score) => sum + score.score, 0) /
          row.evaluationResult.scores.length
        : undefined;
      return (
        row.attemptStatus !== "reviewed" ||
        row.sessionStatus === "too_short" ||
        (average !== undefined && average < 3)
      );
    })
    .slice(0, 6)
    .map((row) => toQuestionRecord(row.question));
}
