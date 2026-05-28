import { and, desc, eq } from "drizzle-orm";

import type { SessionDebriefRecord, SessionHistoryItem } from "@/product/interview-types";
import { getCoachingMemory } from "@/server/coaching-memory/coaching-memory";
import { getDb } from "@/server/db/client";
import { debriefs, evaluations, sessions } from "@/server/db/schema";
import { generateSessionDebrief } from "@/server/debriefs/debrief-ai";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";
import { recordDebriefProgression } from "@/server/progression/progression";

function toSessionHistoryItem(row: {
  contextSnapshot: typeof sessions.$inferSelect.contextSnapshot;
  createdAt: Date;
  endedAt: Date | null;
  evaluationError: string | null;
  evaluationStatus: typeof sessions.$inferSelect.evaluationStatus;
  evaluationResult: typeof evaluations.$inferSelect.result | null;
  id: string;
  status: typeof sessions.$inferSelect.status;
  voiceArtifact: typeof sessions.$inferSelect.voiceArtifact | null;
}): SessionHistoryItem {
  return {
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

function toDebriefRecord(row: {
  contextSnapshot: typeof sessions.$inferSelect.contextSnapshot | null;
  createdAt: Date;
  id: string;
  model: string;
  result: typeof debriefs.$inferSelect.result;
  sessionId: string;
  updatedAt: Date;
  userNote: string;
}): SessionDebriefRecord {
  return {
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    model: row.model,
    result: row.result,
    sessionId: row.sessionId,
    targetCompany: row.contextSnapshot?.interviewContext.targetCompany ?? "",
    targetRole: row.contextSnapshot?.interviewContext.targetRole || "General practice",
    updatedAt: row.updatedAt.toISOString(),
    userNote: row.userNote,
  };
}

export async function listSessionDebriefs(
  userId: string,
  limit = 25,
): Promise<SessionDebriefRecord[]> {
  const rows = await getDb()
    .select({
      contextSnapshot: sessions.contextSnapshot,
      createdAt: debriefs.createdAt,
      id: debriefs.id,
      model: debriefs.model,
      result: debriefs.result,
      sessionId: debriefs.sessionId,
      updatedAt: debriefs.updatedAt,
      userNote: debriefs.userNote,
    })
    .from(debriefs)
    .leftJoin(sessions, eq(sessions.id, debriefs.sessionId))
    .where(eq(debriefs.userId, userId))
    .orderBy(desc(debriefs.createdAt))
    .limit(limit);

  return rows.map(toDebriefRecord);
}

export async function createSessionDebrief({
  sessionId,
  userId,
  userNote,
}: {
  sessionId: string;
  userId: string;
  userNote: string;
}): Promise<SessionDebriefRecord | undefined> {
  const [sessionRow] = await getDb()
    .select({
      contextSnapshot: sessions.contextSnapshot,
      createdAt: sessions.createdAt,
      endedAt: sessions.endedAt,
      evaluationError: sessions.evaluationError,
      evaluationResult: evaluations.result,
      evaluationStatus: sessions.evaluationStatus,
      id: sessions.id,
      status: sessions.status,
      voiceArtifact: sessions.voiceArtifact,
    })
    .from(sessions)
    .leftJoin(evaluations, eq(evaluations.sessionId, sessions.id))
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!sessionRow) {
    return undefined;
  }

  const session = toSessionHistoryItem(sessionRow);

  if (session.transcript.length === 0) {
    throw new Error("Debrief needs a saved transcript first.");
  }

  const [promptConfig, memory] = await Promise.all([
    getActivePromptConfig("session_debrief"),
    getCoachingMemory(userId),
  ]);
  const result = await generateSessionDebrief({
    memory,
    promptConfig,
    session,
    userId,
    userNote,
  });
  const now = new Date();
  const [row] = await getDb()
    .insert(debriefs)
    .values({
      model: promptConfig.model,
      promptConfigKey: promptConfig.key,
      promptConfigVersion: promptConfig.version,
      result,
      sessionId,
      updatedAt: now,
      userId,
      userNote,
    })
    .returning();
  await recordDebriefProgression(userId, sessionId);

  return toDebriefRecord({
    contextSnapshot: sessionRow.contextSnapshot,
    createdAt: row.createdAt,
    id: row.id,
    model: row.model,
    result: row.result,
    sessionId: row.sessionId,
    updatedAt: row.updatedAt,
    userNote: row.userNote,
  });
}
