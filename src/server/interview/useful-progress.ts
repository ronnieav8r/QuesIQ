import { createHash } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { progressFilterSchema, recommendationDismissSchema, type RecommendationResponse, type PracticeRecommendation } from "@quesiq/interview-contracts";
import { getDb } from "@/server/db/client";
import { sessions, interviewCoachingOperations, interviewAnswerEvaluations, evaluations, interviewRecommendationDismissals as dismissals, jobTargets, interviewQuestions, stories, introductions } from "@/server/db/schema";
import { getProfile } from "@/server/profiles/get-profile";
import { PreparationError } from "@/server/profiles/preparation";
import { assertOwnedTarget, readQuestionPreferences } from "./question-preferences";
import { projectEvidence, type EvidenceInput } from "./evidence-projection";
import { resolveInterviewExecutionSnapshot } from "./execution-config";
import type { SessionSetupSnapshot } from "@/product/interview-types";
import { getAccessibleInterviewQuestion, toSelectedQuestionContext } from "./question-bank";

export async function readOwnedEvidence(userId: string): Promise<EvidenceInput> {
  const db = getDb();
  const [owned, operations, reviews, results] = await Promise.all([
    db.select().from(sessions).where(eq(sessions.userId, userId)),
    db.select({ row: interviewCoachingOperations }).from(interviewCoachingOperations).innerJoin(sessions, and(eq(sessions.id, interviewCoachingOperations.targetId), eq(sessions.userId, userId))).where(eq(interviewCoachingOperations.userId, userId)),
    db.select({ row: interviewAnswerEvaluations }).from(interviewAnswerEvaluations).innerJoin(sessions, and(eq(sessions.id, interviewAnswerEvaluations.sessionId), eq(sessions.userId, userId))).where(eq(interviewAnswerEvaluations.userId, userId)),
    db.select({ row: evaluations }).from(evaluations).innerJoin(sessions, and(eq(sessions.id, evaluations.sessionId), eq(sessions.userId, userId))).where(eq(evaluations.userId, userId)),
  ]);
  return { sessions: owned, operations: operations.map(({ row }) => row), reviews: reviews.map(({ row }) => row), evaluations: results.map(({ row }) => row) };
}
export async function readProgress(userId: string, input: unknown, now = new Date()) {
  const parsed = progressFilterSchema.safeParse(input);
  if (!parsed.success) throw new PreparationError("invalid_filter", "Choose a valid target and time range.", 400);
  const { target, range } = parsed.data;
  let targetId = target === "active" ? (await getProfile(userId))?.jobTargetId ?? null : target === "general" || target === "all" ? null : target;
  // Historical copies retain deleted target IDs. Explicit historical filters must
  // still belong to this user; active selection never silently changes targets.
  if (target === "active" && targetId) {
    const [owned] = await getDb().select().from(jobTargets).where(and(eq(jobTargets.id, targetId), eq(jobTargets.userId, userId)));
    if (!owned) targetId = null;
  } else if (targetId) await assertOwnedTarget(userId, targetId);
  return projectEvidence(await readOwnedEvidence(userId), { targetId, allTargets: target === "all", range }, now);
}

/** Deterministic read-only policy: never generates questions or evaluates answers. */
export async function readRecommendations(userId: string, targetId?: string | null, now = new Date()): Promise<RecommendationResponse> {
  if (targetId === undefined) targetId = (await getProfile(userId))?.jobTargetId ?? null;
  await assertOwnedTarget(userId, targetId);
  const [preferences, evidence, hidden, targets] = await Promise.all([
    readQuestionPreferences(userId), readOwnedEvidence(userId),
    getDb().select().from(dismissals).where(and(eq(dismissals.userId, userId), gt(dismissals.expiresAt, now))),
    getDb().select().from(jobTargets).where(eq(jobTargets.userId, userId)),
  ]);
  const progress = projectEvidence(evidence, { targetId, range: "90" }, now);
  const reviewedIds = new Set([...new Set(progress.attempts.filter(row => row.review).map(row => row.sessionId))].slice(0, 20));
  const enabled = new Set<string>();
  for (const modeKey of ["coaching", "first_impression", "rapid_fire"] as const) {
    try { await resolveInterviewExecutionSnapshot({ modeKey, styleKey: "friendly", interviewContext: { preferredName: "", targetRole: "", targetCompany: "", jobDescription: "" } }, "native"); enabled.add(modeKey); }
    catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === "mode_disabled")) throw error; }
  }
  const candidates: PracticeRecommendation[] = [];
  const add = (value: Omit<PracticeRecommendation, "id" | "targetLabel">, salt = "") => {
    if (!enabled.has(value.mode)) return;
    const target = targets.find(row => row.id === value.targetId);
    const targetLabel = target ? `${target.targetRole}${target.targetCompany ? ` · ${target.targetCompany}` : ""}` : "General practice";
    const id = createHash("sha256").update(JSON.stringify([value.reasonCode, value.mode, value.targetId, value.questionId, value.evidence?.attemptId, value.category, salt])).digest("hex");
    if (!hidden.some(row => row.recommendationId === id) && !candidates.some(row => row.id === id)) candidates.push({ ...value, id, targetLabel });
  };
  const items = new Map([...preferences.bank, ...preferences.saved].map(row => [row.id, row]));
  for (const scope of targetId ? [targetId, null] : [null]) for (const id of preferences.queues.find(row => row.targetId === scope)?.ids ?? []) {
    const item = items.get(id); if (!item?.available) continue;
    const mode = item.compatibleModes.includes("coaching") ? "coaching" : item.compatibleModes.includes("rapid_fire") ? "rapid_fire" : undefined;
    if (mode) add({ action: "Practice your priority question", mode, targetId: scope, reasonCode: "priority", reason: "You marked this for practice.", questionId: id, questionText: item.text });
  }
  for (const attempt of progress.attempts.filter(row => row.review && reviewedIds.has(row.sessionId) && row.classification !== "guided_retry")) {
    const original = evidence.sessions.find(row => row.id === attempt.sessionId)!;
    const selection = original.contextSnapshot.preparationSelections;
    if (selection?.storyId) { const [material] = await getDb().select().from(stories).where(and(eq(stories.userId, userId), eq(stories.id, selection.storyId))); if (!material?.reviewedAt) continue; }
    if (selection?.introductionId) { const [material] = await getDb().select().from(introductions).where(and(eq(introductions.userId, userId), eq(introductions.id, selection.introductionId))); if (!material?.reviewedAt) continue; }
    const queue = original.contextSnapshot.selectedQuestionQueueContext ?? [];
    const bankId = queue.find(row => row.questionText === attempt.question)?.id;
    if (bankId) {
      const [question] = await getDb().select().from(interviewQuestions).where(eq(interviewQuestions.id, bankId));
      if (!question?.enabled || (question.source !== "official" && question.ownerUserId !== userId) || !question.compatibleModes.includes("coaching")) continue;
    }
    add({ action: "Try this answer again", mode: "coaching", targetId, reasonCode: "review_retry", reason: `Your saved review suggested: ${attempt.review!.improvement}`, questionText: attempt.question, questionId: bankId, evidence: attempt.evidence }, JSON.stringify(attempt.review));
  }
  for (const item of preferences.saved.filter(row => row.available && row.compatibleModes.includes("coaching"))) add({ action: "Practice a saved question", mode: "coaching", targetId, reasonCode: "saved_question", reason: "You saved this question for future practice.", questionId: item.id, questionText: item.text });
  if (progress.counts.sessions) {
    const categories = progress.categories.filter(row => row.key !== "general").sort((a, b) => a.sessions - b.sessions || a.key.localeCompare(b.key));
    for (const category of categories) {
      const item = preferences.bank.find(row => row.available && row.category === category.key && row.compatibleModes.includes("coaching"));
      if (item) add({ action: `Practice ${category.label.toLowerCase()}`, mode: "coaching", targetId, reasonCode: "coverage", reason: `${category.label} has ${category.sessions} verified practice sessions in the last 90 days. This is coverage, not a skill rating.`, questionId: item.id, questionText: item.text, category: category.key });
    }
  }
  add({ action: "Practice your introduction", mode: "first_impression", targetId, reasonCode: "cold_start", reason: "Start with a short introduction. No résumé or saved story is required." });
  add({ action: "Try ordinary Coaching", mode: "coaching", targetId, reasonCode: "cold_start", reason: "Choose your own focus and work through one answer at a time." });
  return { suggestions: candidates.slice(0, 3), targetId };
}
export async function dismissRecommendation(userId: string, input: unknown, now = new Date()) {
  const parsed = recommendationDismissSchema.safeParse(input);
  if (!parsed.success) throw new PreparationError("invalid_suggestion", "Suggestion is invalid.", 400);
  const { id, targetId } = parsed.data;
  const current = await readRecommendations(userId, targetId, now);
  if (!current.suggestions.some(row => row.id === id)) return current; // lost acknowledgement is an idempotent no-op
  await getDb().insert(dismissals).values({ userId, recommendationId: id, expiresAt: new Date(now.getTime() + 86400000) }).onConflictDoNothing();
  // Expired rows may be dismissed again; active duplicate requests never extend TTL.
  await getDb().update(dismissals).set({ expiresAt: new Date(now.getTime() + 86400000) }).where(and(eq(dismissals.userId, userId), eq(dismissals.recommendationId, id), lte(dismissals.expiresAt, now)));
  return readRecommendations(userId, targetId, now);
}
export async function resolveRecommendation(userId: string, snapshot: SessionSetupSnapshot): Promise<SessionSetupSnapshot> {
  const selection = snapshot.recommendationSelection;
  if (!selection) return snapshot;
  const current = await readRecommendations(userId, selection.targetId);
  const item = current.suggestions.find(row => row.id === selection.id);
  if (!item) throw new PreparationError("stale_suggestion", "This suggestion changed. Refresh Home or choose your own practice.", 409);
  let questionId = item.questionId;
  if (!questionId && item.questionText) {
    const externalId = "review-retry:" + createHash("sha256").update(userId + "\0" + item.questionText).digest("hex");
    const [question] = await getDb().insert(interviewQuestions).values({ externalId, questionText: item.questionText, source: "custom", ownerUserId: userId, compatibleModes: ["coaching", "rapid_fire"] }).onConflictDoUpdate({ target: interviewQuestions.externalId, set: { externalId } }).returning();
    if (!question.enabled) throw new PreparationError("stale_suggestion", "This question is unavailable.", 409);
    questionId = question.id;
  }
  const question = questionId ? await getAccessibleInterviewQuestion(questionId, userId) : undefined;
  if (questionId && (!question || !question.compatibleModes.includes(item.mode))) throw new PreparationError("stale_suggestion", "This question is unavailable.", 409);
  const selected = question ? [toSelectedQuestionContext(question)] : [];
  return { ...snapshot, modeKey: item.mode, questionSelection: questionId && item.mode !== "first_impression" ? { mode: item.mode, ids: [questionId] } : undefined, selectedQuestionContext: selected[0], selectedQuestionQueueContext: selected.length ? selected : undefined, preparationSelections: { useSavedStories: snapshot.preparationSelections?.useSavedStories ?? true }, interviewContext: { ...snapshot.interviewContext, jobTargetId: item.targetId ?? undefined } };
}
