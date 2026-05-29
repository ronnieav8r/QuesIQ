import { and, desc, eq, inArray } from "drizzle-orm";

import placeholderQuestions from "@/features/dpe/placeholder-questions.json";
import { formatQuestion } from "@/features/dpe/question-format";
import {
  type DpeQuestion,
  type QuestionApiResponse,
} from "@/features/dpe/questions";
import { getDb } from "@/server/db/client";
import {
  dpeCertificateTypes,
  dpeContentVersions,
  dpeOralQuestions,
  dpePracticeSessions,
  dpeQuestionAnswerKeys,
  dpeQuestionRubrics,
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
        input?.acsArea ? eq(dpeOralQuestions.acsArea, input.acsArea) : undefined,
        input?.acsTask ? eq(dpeOralQuestions.acsTask, input.acsTask) : undefined,
      ),
    )
    .orderBy(dpeOralQuestions.acsArea, dpeOralQuestions.acsTask, dpeOralQuestions.id)
    .limit(limit);

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

  if (questions.length === 0 && !input?.acsArea && !input?.acsTask) {
    return fallbackQuestionResponse();
  }

  const allRows = await getDb()
    .select({
      acsArea: dpeOralQuestions.acsArea,
      acsTask: dpeOralQuestions.acsTask,
    })
    .from(dpeOralQuestions)
    .where(eq(dpeOralQuestions.active, true));

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
    countsByArea,
    questions,
    tasksByArea: Object.keys(tasksByArea).length ? tasksByArea : { I: ["A"] },
  };
}

export async function listDpePracticeSessions(userId: string) {
  return getDb()
    .select()
    .from(dpePracticeSessions)
    .where(eq(dpePracticeSessions.userId, userId))
    .orderBy(desc(dpePracticeSessions.createdAt))
    .limit(20);
}

export async function createDpePracticeSession(input: {
  acsArea: string;
  acsTask: string;
  acsTitle: string;
  mode: string;
  questions: unknown[];
  startedAt?: string;
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
        questions: input.questions,
      },
      userId: input.userId,
    })
    .returning();

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
  const skipped = answers.filter((answer) => answer.skipped || !answer.response).length;

  return {
    model: null,
    nextPracticeAction: "Repeat this task and answer each prompt in complete sentences.",
    promptConfigKey: "dpe_post_session_review",
    promptConfigVersion: 1,
    scores: {
      checkrideReadiness: null,
      communication: null,
      knowledge: null,
      riskManagement: null,
      scenarioJudgment: null,
    },
    status: "fallback",
    summary: "The transcript was saved. AI review will appear here when OpenAI is configured.",
    weakAcsReferences: answers
      .filter((answer) => answer.skipped || !answer.response)
      .map((answer) => answer.question.acsElementReference),
    whatToSharpen: skipped
      ? [`${skipped} prompt${skipped === 1 ? "" : "s"} skipped or left blank.`]
      : ["Use complete, checkride-style answers with examples when helpful."],
    whatWorked: [
      `${answers.length - skipped} prompt${answers.length - skipped === 1 ? "" : "s"} answered.`,
    ],
  };
}
