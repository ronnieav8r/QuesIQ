import { createHash } from "node:crypto";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { savedQuestionActionSchema, type QuestionPreferences, type SavedQuestion } from "@quesiq/interview-contracts";
import { getDb } from "@/server/db/client";
import { interviewQuestions as questions, interviewQuestionBookmarks as bookmarks, interviewQuestionQueues as queues, jobTargets, sessions, interviewCoachingOperations } from "@/server/db/schema";
import { getAccessibleInterviewQuestion } from "./question-bank";
import { PreparationError } from "@/server/profiles/preparation";

const scope = (targetId?: string | null) => targetId || "general";
export async function assertOwnedTarget(userId: string, targetId?: string | null) {
  if (!targetId) return;
  const [row] = await getDb().select({ id: jobTargets.id }).from(jobTargets).where(and(eq(jobTargets.userId, userId), eq(jobTargets.id, targetId)));
  if (!row) throw new PreparationError("not_found", "Target is no longer available.", 404);
}
export async function readQuestionPreferences(userId: string): Promise<QuestionPreferences> {
  const db = getDb();
  const [saved, bank, queueRows, targets] = await Promise.all([
    db.select({ bookmark: bookmarks, question: questions }).from(bookmarks).leftJoin(questions, eq(bookmarks.questionId, questions.id)).where(eq(bookmarks.userId, userId)).orderBy(bookmarks.createdAt, bookmarks.questionId),
    db.select().from(questions).where(and(eq(questions.enabled, true), or(eq(questions.source, "official"), eq(questions.ownerUserId, userId)))).orderBy(questions.displayOrder, questions.id).limit(500),
    db.select().from(queues).where(eq(queues.userId, userId)),
    db.select({ id: jobTargets.id }).from(jobTargets).where(eq(jobTargets.userId, userId)),
  ]);
  const item = (q: typeof questions.$inferSelect): SavedQuestion => ({ id: q.id, text: q.questionText, available: q.enabled && (q.source === "official" || q.ownerUserId === userId), compatibleModes: q.compatibleModes, source: q.source, category: q.tags[0] });
  const missingQueueIds = queueRows.flatMap(row => row.questionIds).filter(id => !bank.some(row => row.id === id));
  if (missingQueueIds.length) bank.push(...await db.select().from(questions).where(and(inArray(questions.id, missingQueueIds), or(eq(questions.source, "official"), eq(questions.ownerUserId, userId)))));
  return { saved: saved.map(({ bookmark, question }) => question ? item(question) : { id: bookmark.questionId, text: bookmark.questionText, available: false, compatibleModes: [], source: "unavailable" }), bank: bank.map(item),
    queues: queueRows.filter(row => row.scope === "general" || targets.some(target => target.id === row.scope)).map(row => ({ targetId: row.scope === "general" ? null : row.scope, revision: row.revision, ids: row.questionIds })) };
}
export async function savedSessionQuestions(userId: string, sessionId: string) {
  const [session] = await getDb().select().from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
  if (!session) throw new PreparationError("not_found", "Session not found.", 404);
  const rows = await getDb().select().from(interviewCoachingOperations).where(and(eq(interviewCoachingOperations.userId, userId), eq(interviewCoachingOperations.targetId, sessionId))).orderBy(asc(interviewCoachingOperations.turnIndex));
  // Only structured emitted primary questions, or frozen owned queue questions.
  const structured = rows.flatMap(row => {
    const result = row.result;
    const state = result?.exerciseState as { phase?: string; question?: { text?: string }; primaryQuestionIndex?: number } | undefined;
    return row.status === "completed" && (result?.state === "opening_question" || result?.state === "move_on") && state?.phase === "awaiting_answer" && state.question?.text ? [state.question.text] : [];
  });
  if (structured.length) return structured;
  const frozen = session.contextSnapshot.selectedQuestionQueueContext ?? (session.contextSnapshot.selectedQuestionContext ? [session.contextSnapshot.selectedQuestionContext] : []);
  if (frozen.length) return frozen.filter(q => session.voiceArtifact?.transcript.some(turn => turn.role === "assistant" && turn.text.trim() === q.questionText.trim())).map(q => q.questionText);
  // Realtime/legacy sessions have no controller question IDs. Let the learner
  // select an exact saved interviewer turn rather than inventing/paraphrasing it.
  return (session.voiceArtifact?.transcript ?? []).filter(turn => turn.role === "assistant" && turn.text.trim() && turn.text.length <= 2000).map(turn => turn.text);
}
export async function mutateQuestionPreferences(userId: string, input: unknown) {
  const parsed = savedQuestionActionSchema.safeParse(input);
  if (!parsed.success) throw new PreparationError("invalid_questions", "Check the question and queue fields.", 400);
  const change = parsed.data; const db = getDb();
  if (change.action === "queue") {
    await assertOwnedTarget(userId, change.targetId);
    if (new Set(change.ids).size !== change.ids.length) throw new PreparationError("duplicate_question", "Each question can appear only once in Practice next.", 400);
    for (const id of change.ids) if (!await getAccessibleInterviewQuestion(id, userId)) throw new PreparationError("unavailable_question", "An unavailable question cannot be prioritized.", 404);
    await db.transaction(async tx => {
      const key = scope(change.targetId);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`question-queue:${userId}:${key}`}))`);
      const [prior] = await tx.select().from(queues).where(and(eq(queues.userId, userId), eq(queues.scope, key))).for("update");
      if (prior && JSON.stringify(prior.questionIds) === JSON.stringify(change.ids)) return;
      if ((prior?.revision ?? 0) !== change.revision) throw new PreparationError("stale_queue", "Practice next changed. Reload before reordering.");
      await tx.insert(queues).values({ userId, scope: key, questionIds: change.ids, revision: change.revision + 1 }).onConflictDoUpdate({ target: [queues.userId, queues.scope], set: { questionIds: change.ids, revision: change.revision + 1, updatedAt: new Date() } });
    });
  } else if (change.action === "unsave") {
    await db.delete(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.questionId, change.questionId)));
  } else {
    let id: string; let text: string;
    if (change.action === "save") {
      const question = await getAccessibleInterviewQuestion(change.questionId, userId);
      if (!question) throw new PreparationError("unavailable_question", "Question is no longer available.", 404);
      id = question.id; text = question.questionText;
    } else {
      text = change.action === "custom" ? change.text : (await savedSessionQuestions(userId, change.sessionId))[change.questionIndex];
      if (!text) throw new PreparationError("unavailable_question", "This session question could not be verified.", 404);
      const externalId = "saved:" + createHash("sha256").update(userId + "\0" + text).digest("hex");
      const [question] = await db.insert(questions).values({ externalId, questionText: text, source: "custom", sourceLabel: change.action === "custom" ? "Your question" : "Saved session question", ownerUserId: userId, compatibleModes: ["coaching", "rapid_fire"] }).onConflictDoUpdate({ target: questions.externalId, set: { externalId } }).returning();
      id = question.id;
    }
    await db.insert(bookmarks).values({ userId, questionId: id, questionText: text }).onConflictDoNothing();
  }
  return readQuestionPreferences(userId);
}

/** Called only after answer persistence. Favorites deliberately remain untouched. */
export async function clearAnsweredPriorities(userId: string, targetId: string | undefined, questionIds: string[], tx: Pick<ReturnType<typeof getDb>, "execute" | "select" | "update">) {
  if (!questionIds.length) return;
  for (const key of Array.from(new Set(["general", scope(targetId)])).sort()) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`question-queue:${userId}:${key}`}))`);
    const [row] = await tx.select().from(queues).where(and(eq(queues.userId, userId), eq(queues.scope, key))).for("update");
    if (!row) continue;
    const remaining = row.questionIds.filter(id => !questionIds.includes(id));
    if (remaining.length !== row.questionIds.length) await tx.update(queues).set({ questionIds: remaining, revision: row.revision + 1, updatedAt: new Date() }).where(and(eq(queues.userId, userId), eq(queues.scope, key)));
  }
}
