import { and, desc, eq, inArray } from "drizzle-orm";

import placeholderQuestions from "@/features/dpe/placeholder-questions.json";
import { formatQuestion } from "@/features/dpe/question-format";
import {
  type DpeAnswerAttempt,
  type DpeAnswerEvaluation,
  type DpeQuestion,
  type QuestionApiResponse,
} from "@/features/dpe/questions";
import { resolveDpeTargetTrack } from "@/features/dpe/target-tracks";
import { getDb } from "@/server/db/client";
import {
  dpeCertificateTypes,
  dpeCheckrideTargets,
  dpeContentVersions,
  dpeDiagnosticEvents,
  dpeAnswerAttempts,
  dpeOralQuestions,
  dpePracticeSessions,
  dpeProfiles,
  dpeQuestionAssets,
  dpeQuestionAnswerKeys,
  dpeQuestionRubrics,
  dpeSessionQuestions,
} from "@/server/db/schema";

type SessionAnswer = {
  question: DpeQuestion;
  response: string;
  skipped: boolean;
};

export type DpeReviewJson = {
  model: string | null;
  nextPracticeAction: string;
  promptConfigKey: string;
  promptConfigVersion: number;
  scores: {
    checkrideReadiness: number | null;
    communication: number | null;
    knowledge: number | null;
    riskManagement: number | null;
    scenarioJudgment: number | null;
  };
  status: "fallback" | "generated";
  summary: string;
  weakAcsReferences: string[];
  whatToSharpen: string[];
  whatWorked: string[];
};

export function fallbackQuestionResponse(): QuestionApiResponse {
  const questions = (placeholderQuestions as Array<Record<string, unknown>>).map((question) => {
    const aiContext = JSON.stringify(question.aiContext ?? {});
    return formatQuestion({
      active: Boolean(question.active),
      acsArea: String(question.acsArea),
      acsElementReference: String(question.acsElementReference),
      acsElementType: String(question.acsElementType),
      acsTask: String(question.acsTask),
      acsTitle: String(question.acsTitle),
      aiContext,
      answerKey: null,
      certificateType: {
        code: "PRIVATE_PILOT_ASEL",
        id: "private-pilot-asel",
        title: "Private Pilot Airplane Single-Engine Land",
      },
      contentVersion: null,
      difficulty: typeof question.difficulty === "string" ? question.difficulty : null,
      id: String(question.id),
      keywords: typeof question.keywords === "string" ? question.keywords : null,
      primarySubject:
        typeof question.primarySubject === "string" ? question.primarySubject : null,
      questionMode: String(question.questionMode),
      questionText: String(question.questionText),
      rubric: null,
      visualImage: typeof question.visualImage === "string" ? question.visualImage : null,
    });
  });

  return buildQuestionResponse(questions, false);
}

export async function listDpeQuestions(input?: {
  acsArea?: string;
  acsTask?: string;
  certificateTypeId?: string;
  limit?: number;
}): Promise<QuestionApiResponse> {
  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 100);

  const rows = await getDb()
    .select({
      active: dpeOralQuestions.active,
      acsArea: dpeOralQuestions.acsArea,
      acsElementReference: dpeOralQuestions.acsElementReference,
      acsElementType: dpeOralQuestions.acsElementType,
      acsTask: dpeOralQuestions.acsTask,
      acsTitle: dpeOralQuestions.acsTitle,
      aiContext: dpeOralQuestions.aiContext,
      answerKeyAcceptableVariations: dpeQuestionAnswerKeys.acceptableVariations,
      answerKeyCommonMisses: dpeQuestionAnswerKeys.commonMisses,
      answerKeyCorrectAnswerElements: dpeQuestionAnswerKeys.correctAnswerElements,
      answerKeyNotes: dpeQuestionAnswerKeys.notes,
      answerKeySourceReferences: dpeQuestionAnswerKeys.sourceReferences,
      answerKeyStatus: dpeQuestionAnswerKeys.status,
      certificateCode: dpeCertificateTypes.code,
      certificateId: dpeCertificateTypes.id,
      certificateTitle: dpeCertificateTypes.title,
      contentStatus: dpeContentVersions.status,
      contentTitle: dpeContentVersions.title,
      contentVersion: dpeContentVersions.version,
      contentVersionId: dpeContentVersions.id,
      difficulty: dpeOralQuestions.difficulty,
      id: dpeOralQuestions.id,
      keywords: dpeOralQuestions.keywords,
      primarySubject: dpeOralQuestions.primarySubject,
      questionMode: dpeOralQuestions.questionMode,
      questionText: dpeOralQuestions.questionText,
      rubricCheckrideReadiness: dpeQuestionRubrics.checkrideReadiness,
      rubricCommunication: dpeQuestionRubrics.communication,
      rubricKnowledge: dpeQuestionRubrics.knowledge,
      rubricRiskManagement: dpeQuestionRubrics.riskManagement,
      rubricScenarioJudgment: dpeQuestionRubrics.scenarioJudgment,
      rubricScoringNotes: dpeQuestionRubrics.scoringNotes,
      rubricStatus: dpeQuestionRubrics.status,
      visualImage: dpeOralQuestions.visualImage,
    })
    .from(dpeOralQuestions)
    .leftJoin(dpeCertificateTypes, eq(dpeOralQuestions.certificateTypeId, dpeCertificateTypes.id))
    .leftJoin(dpeContentVersions, eq(dpeOralQuestions.contentVersionId, dpeContentVersions.id))
    .leftJoin(dpeQuestionAnswerKeys, eq(dpeQuestionAnswerKeys.questionId, dpeOralQuestions.id))
    .leftJoin(dpeQuestionRubrics, eq(dpeQuestionRubrics.questionId, dpeOralQuestions.id))
    .where(
      and(
        eq(dpeOralQuestions.active, true),
        input?.certificateTypeId
          ? eq(dpeOralQuestions.certificateTypeId, input.certificateTypeId)
          : undefined,
        input?.acsArea ? eq(dpeOralQuestions.acsArea, input.acsArea) : undefined,
        input?.acsTask ? eq(dpeOralQuestions.acsTask, input.acsTask) : undefined,
      ),
    )
    .orderBy(dpeOralQuestions.acsArea, dpeOralQuestions.acsTask, dpeOralQuestions.id)
    .limit(limit);

  const questionIds = rows.map((row) => row.id);
  const assetRows =
    questionIds.length > 0
      ? await getDb()
          .select()
          .from(dpeQuestionAssets)
          .where(inArray(dpeQuestionAssets.questionId, questionIds))
          .orderBy(dpeQuestionAssets.questionId, dpeQuestionAssets.sortOrder)
      : [];
  const assetsByQuestionId = assetRows.reduce<Record<string, DpeQuestion["assets"]>>(
    (accumulator, asset) => {
      accumulator[asset.questionId] ??= [];
      accumulator[asset.questionId].push({
        id: asset.id,
        instructions: asset.instructions,
        label: asset.label,
        metadata: asset.metadata ?? null,
        sortOrder: asset.sortOrder,
        storageKey: asset.storageKey,
        transcript: asset.transcript,
        type: asset.type,
        url: asset.url,
      });
      return accumulator;
    },
    {},
  );

  const questions = rows.map((row) =>
    formatQuestion({
      active: row.active,
      acsArea: row.acsArea,
      acsElementReference: row.acsElementReference,
      acsElementType: row.acsElementType,
      acsTask: row.acsTask,
      acsTitle: row.acsTitle,
      aiContext: row.aiContext,
      answerKey: row.answerKeyStatus
        ? {
            acceptableVariations: row.answerKeyAcceptableVariations,
            commonMisses: row.answerKeyCommonMisses,
            correctAnswerElements: row.answerKeyCorrectAnswerElements ?? [],
            notes: row.answerKeyNotes,
            sourceReferences: row.answerKeySourceReferences,
            status: row.answerKeyStatus,
          }
        : null,
      certificateType: row.certificateId
        ? {
            code: row.certificateCode ?? "",
            id: row.certificateId,
            title: row.certificateTitle ?? "",
          }
        : null,
      contentVersion: row.contentVersionId
        ? {
            id: row.contentVersionId,
            status: row.contentStatus ?? "",
            title: row.contentTitle ?? "",
            version: row.contentVersion ?? 1,
          }
        : null,
      difficulty: row.difficulty,
      id: row.id,
      keywords: row.keywords,
      primarySubject: row.primarySubject,
      questionMode: row.questionMode,
      questionText: row.questionText,
      assets: assetsByQuestionId[row.id] ?? [],
      rubric: row.rubricStatus
        ? {
            checkrideReadiness: row.rubricCheckrideReadiness ?? "",
            communication: row.rubricCommunication ?? "",
            knowledge: row.rubricKnowledge ?? "",
            riskManagement: row.rubricRiskManagement ?? "",
            scenarioJudgment: row.rubricScenarioJudgment ?? "",
            scoringNotes: row.rubricScoringNotes,
            status: row.rubricStatus,
          }
        : null,
      visualImage: row.visualImage,
    }),
  );

  if (questions.length === 0 && !input?.acsArea && !input?.acsTask && !input?.certificateTypeId) {
    return fallbackQuestionResponse();
  }

  const allRows = await getDb()
    .select({
      acsArea: dpeOralQuestions.acsArea,
      acsTask: dpeOralQuestions.acsTask,
    })
    .from(dpeOralQuestions)
    .where(
      and(
        eq(dpeOralQuestions.active, true),
        input?.certificateTypeId
          ? eq(dpeOralQuestions.certificateTypeId, input.certificateTypeId)
          : undefined,
      ),
    );

  return buildQuestionResponse(questions, true, allRows);
}

function buildQuestionResponse(
  questions: DpeQuestion[],
  available: boolean,
  countRows = questions.map((question) => ({
    acsArea: question.acsArea,
    acsTask: question.acsTask,
  })),
): QuestionApiResponse {
  const areas = [...new Set(countRows.map((row) => row.acsArea))].sort();
  const tasksByArea = countRows.reduce<Record<string, string[]>>((accumulator, row) => {
    accumulator[row.acsArea] ??= [];
    if (!accumulator[row.acsArea].includes(row.acsTask)) {
      accumulator[row.acsArea].push(row.acsTask);
    }
    accumulator[row.acsArea].sort();
    return accumulator;
  }, {});
  const countsByArea = countRows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.acsArea] = (accumulator[row.acsArea] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    available,
    areas: areas.length ? areas : ["I"],
    certificateTypes: buildCertificateTypeOptions(questions),
    countsByArea,
    questions,
    tasksByArea: Object.keys(tasksByArea).length ? tasksByArea : { I: ["A"] },
  };
}

function buildCertificateTypeOptions(questions: DpeQuestion[]): QuestionApiResponse["certificateTypes"] {
  const options = questions.reduce<Record<string, QuestionApiResponse["certificateTypes"][number]>>(
    (accumulator, question) => {
      if (!question.certificateType) return accumulator;

      accumulator[question.certificateType.id] ??= {
        code: question.certificateType.code,
        id: question.certificateType.id,
        questionCount: 0,
        title: question.certificateType.title,
      };
      accumulator[question.certificateType.id].questionCount += 1;
      return accumulator;
    },
    {},
  );

  return Object.values(options).sort((left, right) => left.title.localeCompare(right.title));
}

export async function listDpePracticeSessions(userId: string) {
  return getDb()
    .select()
    .from(dpePracticeSessions)
    .where(eq(dpePracticeSessions.userId, userId))
    .orderBy(desc(dpePracticeSessions.createdAt))
    .limit(20);
}

export async function listDpeDiagnosticEvents(userId: string, limit = 20) {
  return getDb()
    .select({
      code: dpeDiagnosticEvents.code,
      createdAt: dpeDiagnosticEvents.createdAt,
      id: dpeDiagnosticEvents.id,
      message: dpeDiagnosticEvents.message,
      metadata: dpeDiagnosticEvents.metadata,
      sessionId: dpeDiagnosticEvents.sessionId,
      severity: dpeDiagnosticEvents.severity,
      surface: dpeDiagnosticEvents.surface,
    })
    .from(dpeDiagnosticEvents)
    .leftJoin(dpePracticeSessions, eq(dpePracticeSessions.id, dpeDiagnosticEvents.sessionId))
    .where(eq(dpePracticeSessions.userId, userId))
    .orderBy(desc(dpeDiagnosticEvents.createdAt))
    .limit(limit);
}

export async function createDpePracticeSession(input: {
  acsArea: string;
  acsTask: string;
  acsTitle: string;
  certificateType?: {
    code: string;
    id: string;
    title: string;
  } | null;
  mode: string;
  questions: unknown[];
  startedAt?: string;
  targetTrack?: unknown;
  userId: string;
}) {
  const [session] = await getDb()
    .insert(dpePracticeSessions)
    .values({
      acsArea: input.acsArea,
      acsTask: input.acsTask,
      acsTitle: input.acsTitle,
      mode: input.mode,
      startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
      status: "in_progress",
      transcriptJson: {
        answers: [],
        certificateType: input.certificateType ?? null,
        questions: input.questions,
        targetTrack: input.targetTrack ?? null,
      },
      userId: input.userId,
    })
    .returning();

  const requestedQuestionIds = input.questions
    .map((question) =>
      typeof question === "object" &&
      question !== null &&
      !Array.isArray(question) &&
      "id" in question &&
      typeof question.id === "string"
        ? question.id
        : null,
    )
    .filter((id): id is string => Boolean(id));

  if (requestedQuestionIds.length > 0) {
    const existingQuestions = await getDb()
      .select({ id: dpeOralQuestions.id })
      .from(dpeOralQuestions)
      .where(inArray(dpeOralQuestions.id, requestedQuestionIds));
    const existingIds = new Set(existingQuestions.map((question) => question.id));
    const sessionQuestionRows = requestedQuestionIds
      .filter((questionId) => existingIds.has(questionId))
      .map((questionId, index) => ({
        questionId,
        sessionId: session.id,
        sortOrder: index,
      }));

    if (sessionQuestionRows.length > 0) {
      await getDb().insert(dpeSessionQuestions).values(sessionQuestionRows).onConflictDoNothing();
    }
  }

  return session;
}

export async function getOwnedDpePracticeSession(id: string, userId: string) {
  const [session] = await getDb()
    .select()
    .from(dpePracticeSessions)
    .where(and(eq(dpePracticeSessions.id, id), eq(dpePracticeSessions.userId, userId)))
    .limit(1);

  return session;
}

export async function updateDpePracticeSession(input: {
  answers?: unknown[];
  endedAt?: string;
  id: string;
  review?: unknown;
  status?: string;
}) {
  const [existing] = await getDb()
    .select({
      transcriptJson: dpePracticeSessions.transcriptJson,
    })
    .from(dpePracticeSessions)
    .where(eq(dpePracticeSessions.id, input.id))
    .limit(1);
  const previousTranscript =
    typeof existing?.transcriptJson === "object" &&
    existing.transcriptJson !== null &&
    !Array.isArray(existing.transcriptJson)
      ? existing.transcriptJson
      : {};

  const [session] = await getDb()
    .update(dpePracticeSessions)
    .set({
      endedAt: input.endedAt ? new Date(input.endedAt) : undefined,
      reviewJson: input.review,
      status: input.status,
      transcriptJson: {
        ...previousTranscript,
        answers: input.answers ?? [],
      },
      updatedAt: new Date(),
    })
    .where(eq(dpePracticeSessions.id, input.id))
    .returning();

  return session;
}

export async function saveDpeReview(input: {
  id: string;
  promptConfigKey: string;
  promptConfigVersion: number;
  review: DpeReviewJson;
}) {
  const [session] = await getDb()
    .update(dpePracticeSessions)
    .set({
      promptConfigKey: input.promptConfigKey,
      promptConfigVersion: input.promptConfigVersion,
      reviewJson: input.review,
      updatedAt: new Date(),
    })
    .where(eq(dpePracticeSessions.id, input.id))
    .returning();

  return session;
}

export async function saveDpeVoiceArtifact(input: {
  artifact: unknown;
  id: string;
  transcriptJson: unknown;
  userId: string;
}) {
  const [existing] = await getDb()
    .select({
      transcriptJson: dpePracticeSessions.transcriptJson,
    })
    .from(dpePracticeSessions)
    .where(and(eq(dpePracticeSessions.id, input.id), eq(dpePracticeSessions.userId, input.userId)))
    .limit(1);
  const previousTranscript =
    typeof existing?.transcriptJson === "object" &&
    existing.transcriptJson !== null &&
    !Array.isArray(existing.transcriptJson)
      ? existing.transcriptJson
      : {};
  const nextTranscript =
    typeof input.transcriptJson === "object" &&
    input.transcriptJson !== null &&
    !Array.isArray(input.transcriptJson)
      ? {
          ...previousTranscript,
          ...input.transcriptJson,
        }
      : previousTranscript;

  const [session] = await getDb()
    .update(dpePracticeSessions)
    .set({
      endedAt:
        typeof input.artifact === "object" &&
        input.artifact !== null &&
        "endedAt" in input.artifact &&
        typeof input.artifact.endedAt === "string"
          ? new Date(input.artifact.endedAt)
          : new Date(),
      reviewJson: undefined,
      status: "completed",
      transcriptJson: nextTranscript,
      updatedAt: new Date(),
    })
    .where(and(eq(dpePracticeSessions.id, input.id), eq(dpePracticeSessions.userId, input.userId)))
    .returning();

  return session;
}

export async function saveDpeAnswerAttempt(input: {
  aiRunId?: string | null;
  attempt: Omit<DpeAnswerAttempt, "id">;
  evaluation: DpeAnswerEvaluation;
  evaluatorModel: string | null;
  inputTokens?: number;
  outputTokens?: number;
  providerRequestId?: string | null;
  question: DpeQuestion;
  sessionId: string;
  totalTokens?: number;
}) {
  const [existingSession] = await getDb()
    .select({ transcriptJson: dpePracticeSessions.transcriptJson })
    .from(dpePracticeSessions)
    .where(eq(dpePracticeSessions.id, input.sessionId))
    .limit(1);
  const transcript =
    typeof existingSession?.transcriptJson === "object" &&
    existingSession.transcriptJson !== null &&
    !Array.isArray(existingSession.transcriptJson)
      ? (existingSession.transcriptJson as {
          answers?: unknown[];
          certificateType?: unknown;
          questions?: unknown[];
          targetTrack?: unknown;
        })
      : {};
  const transcriptQuestions = Array.isArray(transcript.questions) ? transcript.questions : [];
  const questionIndex = transcriptQuestions.findIndex(
    (question) =>
      typeof question === "object" &&
      question !== null &&
      "id" in question &&
      question.id === input.question.id,
  );
  const sortOrder = questionIndex >= 0 ? questionIndex : 0;

  const [sessionQuestion] = await getDb()
    .insert(dpeSessionQuestions)
    .values({
      questionId: input.question.id,
      response: input.attempt.transcriptText,
      sessionId: input.sessionId,
      sortOrder,
    })
    .onConflictDoUpdate({
      set: {
        response: input.attempt.transcriptText,
        sortOrder,
      },
      target: [dpeSessionQuestions.sessionId, dpeSessionQuestions.questionId],
    })
    .returning();

  const [latestAttempt] = await getDb()
    .select({ attemptNumber: dpeAnswerAttempts.attemptNumber })
    .from(dpeAnswerAttempts)
    .where(eq(dpeAnswerAttempts.sessionQuestionId, sessionQuestion.id))
    .orderBy(desc(dpeAnswerAttempts.attemptNumber))
    .limit(1);
  const attemptNumber = (latestAttempt?.attemptNumber ?? 0) + 1;

  const [attempt] = await getDb()
    .insert(dpeAnswerAttempts)
    .values({
      aiRunId: input.aiRunId ?? undefined,
      attemptNumber,
      evaluationJson: input.evaluation,
      evaluatorModel: input.evaluatorModel,
      evaluatorPromptKey: input.attempt.evaluatorPromptKey,
      evaluatorPromptVersion: input.attempt.evaluatorPromptVersion,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      providerRequestId: input.providerRequestId ?? undefined,
      questionId: input.question.id,
      sessionId: input.sessionId,
      sessionQuestionId: sessionQuestion.id,
      submittedAt: new Date(input.attempt.submittedAt),
      totalTokens: input.totalTokens,
      transcriptSource: input.attempt.transcriptSource,
      transcriptText: input.attempt.transcriptText,
    })
    .returning();

  const answers = Array.isArray(transcript.answers) ? [...transcript.answers] : [];
  const displayAnswer = {
    aiRunId: input.aiRunId ?? null,
    attemptId: attempt.id,
    attemptNumber,
    evaluation: input.evaluation,
    evaluatorModel: input.evaluatorModel,
    evaluatorPromptKey: input.attempt.evaluatorPromptKey,
    evaluatorPromptVersion: input.attempt.evaluatorPromptVersion,
    question: input.question,
    response: input.attempt.transcriptText,
    skipped: false,
    submittedAt: input.attempt.submittedAt,
    transcriptSource: input.attempt.transcriptSource,
  };
  const existingAnswerIndex = answers.findIndex(
    (answer) =>
      typeof answer === "object" &&
      answer !== null &&
      "question" in answer &&
      typeof answer.question === "object" &&
      answer.question !== null &&
      "id" in answer.question &&
      answer.question.id === input.question.id,
  );

  if (existingAnswerIndex >= 0) {
    answers[existingAnswerIndex] = displayAnswer;
  } else {
    answers.push(displayAnswer);
  }

  await getDb()
    .update(dpePracticeSessions)
    .set({
      transcriptJson: {
        ...transcript,
        answers,
      },
      updatedAt: new Date(),
    })
    .where(eq(dpePracticeSessions.id, input.sessionId));

  return {
    attempt: {
      ...displayAnswer,
      id: attempt.id,
    },
    attemptRow: attempt,
  };
}

export async function listDpeContentSummary() {
  const certificateTypes = await getDb()
    .select()
    .from(dpeCertificateTypes)
    .orderBy(dpeCertificateTypes.title);
  const certificateIds = certificateTypes.map((certificateType) => certificateType.id);

  if (certificateIds.length === 0) {
    return { available: true, certificateTypes: [] };
  }

  const versions = await getDb()
    .select()
    .from(dpeContentVersions)
    .where(inArray(dpeContentVersions.certificateTypeId, certificateIds))
    .orderBy(desc(dpeContentVersions.version));
  const questions = await getDb()
    .select({
      acsArea: dpeOralQuestions.acsArea,
      acsElementReference: dpeOralQuestions.acsElementReference,
      acsTask: dpeOralQuestions.acsTask,
      active: dpeOralQuestions.active,
      answerKeyStatus: dpeQuestionAnswerKeys.status,
      certificateTypeId: dpeOralQuestions.certificateTypeId,
      contentVersion: dpeContentVersions.version,
      contentVersionStatus: dpeContentVersions.status,
      contentVersionTitle: dpeContentVersions.title,
      id: dpeOralQuestions.id,
      questionText: dpeOralQuestions.questionText,
      rubricStatus: dpeQuestionRubrics.status,
    })
    .from(dpeOralQuestions)
    .leftJoin(dpeQuestionAnswerKeys, eq(dpeQuestionAnswerKeys.questionId, dpeOralQuestions.id))
    .leftJoin(dpeQuestionRubrics, eq(dpeQuestionRubrics.questionId, dpeOralQuestions.id))
    .leftJoin(dpeContentVersions, eq(dpeContentVersions.id, dpeOralQuestions.contentVersionId))
    .where(and(eq(dpeOralQuestions.active, true), inArray(dpeOralQuestions.certificateTypeId, certificateIds)))
    .orderBy(dpeOralQuestions.acsArea, dpeOralQuestions.acsTask, dpeOralQuestions.id);

  return {
    available: true,
    certificateTypes: certificateTypes.map((certificateType) => ({
      active: certificateType.active,
      aircraftClass: certificateType.aircraftClass,
      category: certificateType.category,
      code: certificateType.code,
      contentVersions: versions
        .filter((version) => version.certificateTypeId === certificateType.id)
        .map((version) => ({
          id: version.id,
          notes: version.notes,
          status: version.status,
          title: version.title,
          version: version.version,
        })),
      id: certificateType.id,
      questions: questions
        .filter((question) => question.certificateTypeId === certificateType.id)
        .map((question) => ({
          acsArea: question.acsArea,
          acsElementReference: question.acsElementReference,
          acsTask: question.acsTask,
          active: question.active,
          answerKeyStatus: question.answerKeyStatus ?? "missing",
          contentVersion: question.contentVersion
            ? {
                status: question.contentVersionStatus ?? "",
                title: question.contentVersionTitle ?? "",
                version: question.contentVersion,
              }
            : null,
          id: question.id,
          questionText: question.questionText,
          rubricStatus: question.rubricStatus ?? "missing",
        })),
      title: certificateType.title,
    })),
  };
}

export function buildLocalDpeReviewFromTranscript(transcriptJson: unknown): DpeReviewJson {
  const transcript =
    typeof transcriptJson === "object" && transcriptJson !== null && !Array.isArray(transcriptJson)
      ? (transcriptJson as { answers?: SessionAnswer[] })
      : {};
  const answers = Array.isArray(transcript.answers) ? transcript.answers : [];
  const answered = answers.filter((answer) => !answer.skipped && answer.response.trim()).length;
  const weakAnswers = answers.filter(isWeakDpeAnswer);
  const weakFocuses = buildDpeWeakFocuses(answers);
  const readiness = clampDpeScore(
    Math.round(((answered / Math.max(1, answers.length)) * 5 - (weakAnswers.length / Math.max(1, answers.length)) * 2)),
  );
  const communication = clampDpeScore(
    Math.round(
      averageDpeScore(
        answers
          .filter((answer) => !answer.skipped)
          .map((answer) => Math.min(5, Math.max(1, Math.ceil(answerWordCount(answer) / 12)))),
      ),
    ),
  );
  const nextFocus = weakFocuses[0];

  return {
    model: null,
    nextPracticeAction: nextFocus
      ? `Practice ${nextFocus} again and turn skipped or short answers into complete checkride responses.`
      : "Repeat this ACS task and add practical examples, limits, and risk-management details.",
    promptConfigKey: "dpe_post_session_review",
    promptConfigVersion: 1,
    scores: {
      checkrideReadiness: readiness,
      communication,
      knowledge: readiness,
      riskManagement: readiness,
      scenarioJudgment: readiness,
    },
    status: "fallback",
    summary: `${answered} of ${answers.length} prompts have usable answers. ${
      weakAnswers.length
        ? `${weakAnswers.length} prompt${weakAnswers.length === 1 ? "" : "s"} need another pass.`
        : "No weak answer signal was found in this deterministic review."
    }`,
    weakAcsReferences: weakAnswers.map((answer) => answer.question.acsElementReference),
    whatToSharpen: weakAnswers.length
      ? weakFocuses.map((focus) => `Re-run ${focus} and answer with complete ACS detail.`)
      : ["Use complete, checkride-style answers with examples when helpful."],
    whatWorked: [`${answered} prompt${answered === 1 ? "" : "s"} answered.`],
  };
}

function answerWordCount(answer: SessionAnswer) {
  return answer.response.trim().split(/\s+/).filter(Boolean).length;
}

function isWeakDpeAnswer(answer: SessionAnswer) {
  return answer.skipped || answerWordCount(answer) < 12;
}

function buildDpeWeakFocuses(answers: SessionAnswer[]) {
  const focusMap = answers.reduce<Record<string, { label: string; weak: number }>>(
    (accumulator, answer) => {
      if (!isWeakDpeAnswer(answer)) return accumulator;

      const key = `${answer.question.acsArea}.${answer.question.acsTask}`;
      accumulator[key] ??= {
        label: `Area ${answer.question.acsArea}, Task ${answer.question.acsTask}: ${answer.question.taskTitle}`,
        weak: 0,
      };
      accumulator[key].weak += 1;
      return accumulator;
    },
    {},
  );

  return Object.values(focusMap)
    .sort((left, right) => right.weak - left.weak)
    .map((focus) => focus.label);
}

function averageDpeScore(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function clampDpeScore(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(5, Math.max(1, value));
}

function parseDpeCheckrideDate(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function getDpeProfile(userId: string) {
  const [profile] = await getDb()
    .select()
    .from(dpeProfiles)
    .where(eq(dpeProfiles.userId, userId))
    .limit(1);
  const [target] = await getDb()
    .select()
    .from(dpeCheckrideTargets)
    .where(and(eq(dpeCheckrideTargets.userId, userId), eq(dpeCheckrideTargets.active, true)))
    .limit(1);

  return { profile: profile ?? null, target: target ?? null };
}

export async function saveDpeProfile(input: {
  aircraft?: string;
  aircraftCategory?: string;
  aircraftClass?: string;
  certificate?: string;
  checkrideDate?: string | null;
  flightSchool?: string;
  instructor?: string;
  knownDpeName?: string;
  personalNotes?: string;
  preferredName?: string;
  schoolContext?: string;
  targetTrackId?: string;
  userId: string;
  weakAreaNotes?: string;
}) {
  const now = new Date();
  const [existingProfile] = await getDb()
    .select({ id: dpeProfiles.id })
    .from(dpeProfiles)
    .where(eq(dpeProfiles.userId, input.userId))
    .limit(1);

  const profileValues = {
    aircraft: input.aircraft?.trim() || null,
    flightSchool: input.flightSchool?.trim() || null,
    instructor: input.instructor?.trim() || null,
    knownDpeName: input.knownDpeName?.trim() || null,
    personalNotes: input.personalNotes?.trim() || null,
    preferredName: input.preferredName?.trim() || null,
    updatedAt: now,
    weakAreaNotes: input.weakAreaNotes?.trim() || null,
  };

  if (existingProfile) {
    await getDb().update(dpeProfiles).set(profileValues).where(eq(dpeProfiles.id, existingProfile.id));
  } else {
    await getDb().insert(dpeProfiles).values({
      ...profileValues,
      userId: input.userId,
    });
  }

  const [existingTarget] = await getDb()
    .select({ id: dpeCheckrideTargets.id })
    .from(dpeCheckrideTargets)
    .where(and(eq(dpeCheckrideTargets.userId, input.userId), eq(dpeCheckrideTargets.active, true)))
    .limit(1);
  const selectedTrack = resolveDpeTargetTrack({
    aircraftCategory: input.aircraftCategory,
    aircraftClass: input.aircraftClass,
    certificate: input.certificate,
    targetTrackId: input.targetTrackId,
  });
  const targetValues = {
    aircraft: input.aircraft?.trim() || null,
    aircraftCategory: selectedTrack.aircraftCategory,
    aircraftClass: selectedTrack.aircraftClass,
    certificate: selectedTrack.certificate,
    checkrideDate: parseDpeCheckrideDate(input.checkrideDate),
    knownDpeName: input.knownDpeName?.trim() || null,
    schoolContext: input.schoolContext?.trim() || null,
    updatedAt: now,
  };

  if (existingTarget) {
    await getDb()
      .update(dpeCheckrideTargets)
      .set(targetValues)
      .where(eq(dpeCheckrideTargets.id, existingTarget.id));
  } else {
    await getDb().insert(dpeCheckrideTargets).values({
      ...targetValues,
      userId: input.userId,
    });
  }

  return getDpeProfile(input.userId);
}
