import { desc, eq } from "drizzle-orm";

import type { SessionHistoryItem } from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { evaluations, sessions } from "@/server/db/schema";

export async function listOwnedSessions(userId: string): Promise<SessionHistoryItem[]> {
  const rows = await getDb()
    .select({
      contextSnapshot: sessions.contextSnapshot,
      createdAt: sessions.createdAt,
      endedAt: sessions.endedAt,
      evaluationResult: evaluations.result,
      id: sessions.id,
      modeKey: sessions.modeKey,
      questionTypeKey: sessions.questionTypeKey,
      status: sessions.status,
      styleKey: sessions.styleKey,
    })
    .from(sessions)
    .leftJoin(evaluations, eq(evaluations.sessionId, sessions.id))
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt))
    .limit(12);

  return rows.map((row) => ({
    createdAt: row.createdAt.toISOString(),
    endedAt: row.endedAt?.toISOString(),
    evaluation: row.evaluationResult ?? undefined,
    hasEvaluation: Boolean(row.evaluationResult),
    id: row.id,
    modeKey: row.contextSnapshot.modeKey,
    questionTypeKey: row.contextSnapshot.questionTypeKey,
    status: row.status,
    styleKey: row.contextSnapshot.styleKey,
    targetCompany: row.contextSnapshot.interviewContext.targetCompany,
    targetRole: row.contextSnapshot.interviewContext.targetRole || "General practice",
  }));
}
