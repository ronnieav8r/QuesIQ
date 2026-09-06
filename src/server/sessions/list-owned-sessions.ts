import { and, desc, eq } from "drizzle-orm";

import type { SessionHistoryItem } from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { evaluations, sessions } from "@/server/db/schema";
import { listInterviewAnswerEvaluations } from "@/server/interview/answer-evaluations";

export async function listOwnedSessions(
  userId: string,
  limit = 12,
): Promise<SessionHistoryItem[]> {
  const rows = await getDb()
    .select({
      contextSnapshot: sessions.contextSnapshot,
      createdAt: sessions.createdAt,
      endedAt: sessions.endedAt,
      evaluationError: sessions.evaluationError,
      evaluationStatus: sessions.evaluationStatus,
      evaluationResult: evaluations.result,
      id: sessions.id,
      modeKey: sessions.modeKey,
      questionTypeKey: sessions.questionTypeKey,
      status: sessions.status,
      styleKey: sessions.styleKey,
      voiceArtifact: sessions.voiceArtifact,
    })
    .from(sessions)
    .leftJoin(evaluations, eq(evaluations.sessionId, sessions.id))
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt))
    .limit(limit);

  return Promise.all(rows.map(mapSessionHistoryItem));
}

export async function getOwnedSessionHistoryItem(
  sessionId: string,
  userId: string,
): Promise<SessionHistoryItem | undefined> {
  const [row] = await getDb()
    .select({
      contextSnapshot: sessions.contextSnapshot,
      createdAt: sessions.createdAt,
      endedAt: sessions.endedAt,
      evaluationError: sessions.evaluationError,
      evaluationStatus: sessions.evaluationStatus,
      evaluationResult: evaluations.result,
      id: sessions.id,
      modeKey: sessions.modeKey,
      questionTypeKey: sessions.questionTypeKey,
      status: sessions.status,
      styleKey: sessions.styleKey,
      voiceArtifact: sessions.voiceArtifact,
    })
    .from(sessions)
    .leftJoin(evaluations, eq(evaluations.sessionId, sessions.id))
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  return row ? mapSessionHistoryItem(row) : undefined;
}

type SessionHistoryRow = {
  contextSnapshot: typeof sessions.$inferSelect.contextSnapshot;
  createdAt: typeof sessions.$inferSelect.createdAt;
  endedAt: typeof sessions.$inferSelect.endedAt;
  evaluationError: typeof sessions.$inferSelect.evaluationError;
  evaluationStatus: typeof sessions.$inferSelect.evaluationStatus;
  evaluationResult: typeof evaluations.$inferSelect.result | null;
  id: typeof sessions.$inferSelect.id;
  modeKey: typeof sessions.$inferSelect.modeKey;
  questionTypeKey: typeof sessions.$inferSelect.questionTypeKey;
  status: typeof sessions.$inferSelect.status;
  styleKey: typeof sessions.$inferSelect.styleKey;
  voiceArtifact: typeof sessions.$inferSelect.voiceArtifact;
};

async function mapSessionHistoryItem(row: SessionHistoryRow): Promise<SessionHistoryItem> {
  return {
      answerEvaluations: await listInterviewAnswerEvaluations(row.id),
      contextSnapshot: row.contextSnapshot,
      createdAt: row.createdAt.toISOString(),
      durationSeconds: row.voiceArtifact?.durationSeconds,
      endedAt: row.endedAt?.toISOString(),
      evaluation: row.evaluationResult ?? undefined,
      evaluationError: row.evaluationError ?? undefined,
      evaluationStatus: row.evaluationResult ? "completed" : row.evaluationStatus,
      hasEvaluation: Boolean(row.evaluationResult),
      id: row.id,
      modeKey: row.contextSnapshot.modeKey,
      questionTypeKey: row.contextSnapshot.questionTypeKey,
      status: row.status,
      styleKey: row.contextSnapshot.styleKey,
      targetCompany: row.contextSnapshot.interviewContext.targetCompany,
      targetRole: row.contextSnapshot.interviewContext.targetRole || "General practice",
      transcript: row.voiceArtifact?.transcript ?? [],
  };
}
