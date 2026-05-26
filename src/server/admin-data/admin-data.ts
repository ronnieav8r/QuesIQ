import { desc, eq } from "drizzle-orm";

import type {
  AdminEvaluationRecord,
  AdminProfileRecord,
  AdminSessionRecord,
  AdminUserRecord,
} from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { evaluations, profiles, sessions, users } from "@/server/db/schema";

export async function listAdminData(limit = 100) {
  const [userRows, profileRows, sessionRows, evaluationRows] = await Promise.all([
    getDb()
      .select({
        email: users.email,
        emailVerified: users.emailVerified,
        id: users.id,
        image: users.image,
        name: users.name,
      })
      .from(users)
      .limit(limit),
    getDb()
      .select({
        preferredName: profiles.preferredName,
        resumeName: profiles.resumeName,
        targetCompany: profiles.targetCompany,
        targetRole: profiles.targetRole,
        updatedAt: profiles.updatedAt,
        userEmail: users.email,
        userId: profiles.userId,
      })
      .from(profiles)
      .leftJoin(users, eq(users.id, profiles.userId))
      .orderBy(desc(profiles.updatedAt))
      .limit(limit),
    getDb()
      .select({
        contextSnapshot: sessions.contextSnapshot,
        createdAt: sessions.createdAt,
        evaluationStatus: sessions.evaluationStatus,
        id: sessions.id,
        modeKey: sessions.modeKey,
        questionTypeKey: sessions.questionTypeKey,
        status: sessions.status,
        styleKey: sessions.styleKey,
        userEmail: users.email,
        userId: sessions.userId,
        voiceArtifact: sessions.voiceArtifact,
      })
      .from(sessions)
      .leftJoin(users, eq(users.id, sessions.userId))
      .orderBy(desc(sessions.createdAt))
      .limit(limit),
    getDb()
      .select({
        contextSnapshot: sessions.contextSnapshot,
        createdAt: evaluations.createdAt,
        id: evaluations.id,
        model: evaluations.model,
        result: evaluations.result,
        sessionId: evaluations.sessionId,
        status: evaluations.status,
        userEmail: users.email,
        userId: evaluations.userId,
      })
      .from(evaluations)
      .leftJoin(users, eq(users.id, evaluations.userId))
      .leftJoin(sessions, eq(sessions.id, evaluations.sessionId))
      .orderBy(desc(evaluations.createdAt))
      .limit(limit),
  ]);

  const adminUsers: AdminUserRecord[] = userRows.map((row) => ({
    email: row.email ?? undefined,
    emailVerified: row.emailVerified?.toISOString(),
    id: row.id,
    image: row.image ?? undefined,
    name: row.name ?? undefined,
  }));
  const adminProfiles: AdminProfileRecord[] = profileRows.map((row) => ({
    preferredName: row.preferredName,
    resumeName: row.resumeName ?? undefined,
    targetCompany: row.targetCompany,
    targetRole: row.targetRole,
    updatedAt: row.updatedAt.toISOString(),
    userEmail: row.userEmail ?? undefined,
    userId: row.userId,
  }));
  const adminSessions: AdminSessionRecord[] = sessionRows.map((row) => ({
    createdAt: row.createdAt.toISOString(),
    evaluationStatus: row.evaluationStatus,
    id: row.id,
    modeKey: row.modeKey,
    questionTypeKey: row.questionTypeKey ?? undefined,
    status: row.status,
    styleKey: row.styleKey,
    targetRole: row.contextSnapshot.interviewContext.targetRole || "General practice",
    transcriptTurns: row.voiceArtifact?.transcript.length ?? 0,
    userEmail: row.userEmail ?? undefined,
    userId: row.userId ?? undefined,
  }));
  const adminEvaluations: AdminEvaluationRecord[] = evaluationRows.map((row) => ({
    averageScore:
      row.result.scores.reduce((sum, score) => sum + score.score, 0) /
      row.result.scores.length,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    model: row.model,
    sessionId: row.sessionId,
    status: row.status,
    summary: row.result.summary,
    targetRole: row.contextSnapshot?.interviewContext.targetRole || "General practice",
    userEmail: row.userEmail ?? undefined,
    userId: row.userId ?? undefined,
  }));

  return {
    evaluations: adminEvaluations,
    profiles: adminProfiles,
    sessions: adminSessions,
    users: adminUsers,
  };
}
