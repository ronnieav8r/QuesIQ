import { desc, eq } from "drizzle-orm";

import type { SessionHistoryItem } from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { evaluations, sessions } from "@/server/db/schema";

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

  return rows.map((row) => ({
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
  }));
}
