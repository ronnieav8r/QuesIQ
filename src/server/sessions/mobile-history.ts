import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { deriveCoachingAttempts, sessionHistoryPageSchema, type ReviewAccess, type SessionHistoryPage } from "@quesiq/interview-contracts";
import { getDb } from "@/server/db/client";
import { aiRuns, evaluations, interviewAnswerEvaluations, sessions, stories, introductions } from "@/server/db/schema";
import { readOwnedEvidence } from "@/server/interview/useful-progress";
import { projectEvidence } from "@/server/interview/evidence-projection";
import { getOwnedSessionHistoryItem } from "./list-owned-sessions";
import { listCoachingOperations } from "@/server/interview/coaching-operations";
import { hasUsableInterviewAnswerContent } from "@/product/interview-meta-input";
import { getTooShortReviewMessage, isArtifactTooShortToReview } from "@/product/review-eligibility";

const cursorSchema = z.object({ v: z.literal(1), id: z.string().uuid(), at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/).refine((value) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 23) === value.slice(0, 23);
}) }).strict();
export function parseHistoryPageRequest(url: string) {
  const params = new URL(url).searchParams;
  const limit = params.get("limit") ?? "20";
  if (!/^[1-9]\d?$/.test(limit) || Number(limit) > 50) throw new Error("Invalid page size.");
  const encoded = params.get("cursor");
  if (encoded !== null && (!encoded || encoded.length > 512 || !/^[\w-]+$/.test(encoded))) throw new Error("Invalid cursor.");
  const cursor = encoded ? cursorSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))) : undefined;
  return { limit: Number(limit), cursor };
}

export async function listMobileHistory(userId: string, page: ReturnType<typeof parseHistoryPageRequest>): Promise<SessionHistoryPage> {
  const rows = await getDb().select({
    id: sessions.id, createdAt: sessions.createdAt, endedAt: sessions.endedAt,
    // Preserve SQL precision in the cursor; JS Date would lose microseconds.
    cursorAt: sql<string>`to_char(${sessions.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    modeKey: sessions.modeKey, styleKey: sessions.styleKey, status: sessions.status, evaluationStatus: sessions.evaluationStatus,
    hasEvaluation: sql<boolean>`exists(select 1 from ${evaluations} where ${evaluations.sessionId} = ${sessions.id} and ${evaluations.userId} = ${userId})`,
    targetRole: sql<string>`${sessions.contextSnapshot}->'interviewContext'->>'targetRole'`,
    targetCompany: sql<string>`${sessions.contextSnapshot}->'interviewContext'->>'targetCompany'`,
    durationSeconds: sql<number | null>`(${sessions.voiceArtifact}->>'durationSeconds')::double precision`,
  }).from(sessions).where(and(eq(sessions.userId, userId), inArray(sessions.practiceProvenance, ["learner", "legacy_unknown"]), inArray(sessions.modeKey, ["coaching", "rapid_fire", "mock_interview", "first_impression"]),
    page.cursor ? or(sql`${sessions.createdAt} < ${page.cursor.at}::timestamptz`,
      and(sql`${sessions.createdAt} = ${page.cursor.at}::timestamptz`, lt(sessions.id, page.cursor.id))) : undefined))
    .orderBy(desc(sessions.createdAt), desc(sessions.id)).limit(page.limit + 1);
  const visible = rows.slice(0, page.limit); const last = visible.at(-1);
  return sessionHistoryPageSchema.parse({ sessions: visible.map((row) => ({ ...row,
    modeKey: row.modeKey as SessionHistoryPage["sessions"][number]["modeKey"], createdAt: row.createdAt.toISOString(),
    endedAt: row.endedAt?.toISOString(), durationSeconds: row.durationSeconds ?? undefined,
    targetRole: row.targetRole || "General practice", targetCompany: row.targetCompany || "",
    evaluationStatus: row.hasEvaluation ? "completed" : row.evaluationStatus,
  })), nextCursor: rows.length > page.limit && last ? Buffer.from(JSON.stringify({ v: 1, at: last.cursorAt, id: last.id })).toString("base64url") : null });
}

export async function getMobileReviewAccess(sessionId: string, userId: string, db: Pick<ReturnType<typeof getDb>, "select"> = getDb()): Promise<ReviewAccess | undefined> {
  const [session] = await db.select().from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
  if (!session) return undefined;
  const [review] = await db.select({ id: evaluations.id }).from(evaluations).where(and(eq(evaluations.sessionId, sessionId), eq(evaluations.userId, userId)));
  if (review) return { kind: "ready", message: "Your saved review is ready.", canRequest: false };
  if (session.evaluationStatus === "processing") return { kind: "processing", message: "Review processing. Refresh checks its status without starting another evaluation.", canRequest: false };
  if (!session.voiceArtifact?.endedAt || !session.voiceArtifact.transcript.length) return { kind: "unavailable", message: "Save an answer transcript before requesting a review.", canRequest: false };
  if (!hasUsableInterviewAnswerContent(session.voiceArtifact)) return { kind: "too_short", message: "Not enough interview-answer content to assess. Start a new practice and give a substantive answer.", canRequest: false };
  if (isArtifactTooShortToReview(session.contextSnapshot, session.voiceArtifact)) return { kind: "too_short", message: getTooShortReviewMessage(session.contextSnapshot), canRequest: false };
  // Include per-answer model work: uncertainty there must also prevent rebilling.
  const runs = await db.select({ status: aiRuns.status, rawJson: aiRuns.rawJson }).from(aiRuns)
    .where(and(eq(aiRuns.sessionId, sessionId), eq(aiRuns.userId, userId), inArray(aiRuns.runType, ["evaluation", "interview_answer_evaluation"]),
      sql`(${aiRuns.runType} = 'evaluation' or not exists (select 1 from ${interviewAnswerEvaluations} where ${interviewAnswerEvaluations.aiRunId} = ${aiRuns.id} and ${interviewAnswerEvaluations.userId} = ${userId} and ${interviewAnswerEvaluations.sessionId} = ${sessionId}))`))
    .orderBy(desc(aiRuns.startedAt));
  if (session.evaluationStatus === "completed" || (session.evaluationStatus === "failed" && runs.length === 0) ||
    runs.some((run) => run.status === "started" || (run.status === "failed" && run.rawJson?.providerOutcome !== "confirmed_rejection")) ||
    runs.some((run) => run.status === "succeeded")) {
    return { kind: "uncertain", message: "A previous evaluation may have run, but no complete review is saved. Automatic or repeated paid evaluation is blocked; refresh or request support.", canRequest: false };
  }
  return { kind: "eligible", message: session.evaluationStatus === "failed" ? "The review did not complete. You can explicitly retry; this may incur AI usage." : "Your saved answer is ready for evaluation. Requesting it may incur AI usage.", canRequest: true };
}

export async function getMobileSessionDetail(sessionId: string, userId: string) {
  const session = await getOwnedSessionHistoryItem(sessionId, userId);
  if (!session) return undefined;
  const snapshot = session.contextSnapshot;
  const attempts = deriveCoachingAttempts({ targetId: sessionId, rows: await listCoachingOperations(sessionId, userId),
    promptProfile: snapshot?.executionConfig ? "current" : "legacy", model: snapshot?.executionConfig?.effective.textModel,
    promptVersions: snapshot?.executionConfig?.promptVersions });
  const evidence = await readOwnedEvidence(userId);
  const source = evidence.sessions.find(row => row.id === sessionId);
  const projection = projectEvidence(evidence, { targetId: null, allTargets: true, range: "all" });
  const preparationHistory = await Promise.all((snapshot?.reviewedMaterialVersions ?? []).map(async item => {
    const table = item.kind === "story" ? stories : introductions;
    const [current] = await getDb().select({ revision: table.revision }).from(table).where(and(eq(table.id, item.id), eq(table.userId, userId)));
    return { title: item.title, revision: item.revision, status: !current ? "deleted" as const : current.revision === item.revision ? "available" as const : "changed" as const };
  }));
  return { ...session, reviewAccess: (await getMobileReviewAccess(sessionId, userId))!, attempts, provenance: source?.practiceProvenance ?? "legacy_unknown", preparationHistory,
    progressEvidence: projection.attempts.filter(row => row.sessionId === sessionId).map(row => ({ id: row.id, turnIndex: row.turnIndex, question: row.question, answer: row.answer, classification: row.classification, finding: row.review?.finding, improvement: row.review?.improvement })) };
}
