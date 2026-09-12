import { createHash } from "node:crypto";
import { coachingExerciseStateSchema, type ProgressAttempt, type ProgressResponse } from "@quesiq/interview-contracts";
import { storyCategories } from "@quesiq/interview-contracts";
import type { sessions, evaluations, interviewAnswerEvaluations, interviewCoachingOperations } from "@/server/db/schema";

export type EvidenceInput = {
  sessions: Array<typeof sessions.$inferSelect>;
  operations: Array<typeof interviewCoachingOperations.$inferSelect>;
  reviews: Array<typeof interviewAnswerEvaluations.$inferSelect>;
  evaluations: Array<typeof evaluations.$inferSelect>;
};
const normalized = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();
export const substantiveAnswer = (text: string) => text.trim().split(/\s+/).filter(Boolean).length >= 8;
export const categoryLabel = (key: string) => key.split("_").map(word => word[0]?.toUpperCase() + word.slice(1)).join(" ");
export function projectEvidence(input: EvidenceInput, filter: { targetId: string | null; allTargets?: boolean; range: "30" | "90" | "all" }, now = new Date()): ProgressResponse {
  const since = filter.range === "all" ? -Infinity : now.getTime() - Number(filter.range) * 86400000;
  const counts: ProgressResponse["counts"] = { sessions: 0, independentSessions: 0, initialAnswers: 0, subsequentAttempts: 0, repeatedAnswers: 0, unclassifiedSessions: 0, excludedLegacySessions: 0 };
  const attempts: ProgressAttempt[] = []; const quality: ProgressResponse["quality"] = [];
  const encounters = new Map<string, string>();
  const selected = [...input.sessions].filter(row => filter.allTargets || (row.contextSnapshot.interviewContext.jobTargetId ?? null) === filter.targetId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  for (const session of selected) {
    const inRange = session.createdAt.getTime() >= since && session.createdAt <= now;
    if (session.practiceProvenance !== "learner" || session.provenanceVersion !== 1) {
      if (inRange && session.practiceProvenance === "legacy_unknown") counts.excludedLegacySessions++;
      continue;
    }
    const sessionAttempts: ProgressAttempt[] = [];
    let previous: ReturnType<typeof coachingExerciseStateSchema.parse> | undefined;
    for (const operation of input.operations.filter(row => row.targetId === session.id && row.userId === session.userId).sort((a, b) => a.turnIndex - b.turnIndex)) {
      const result = operation.result; const parsed = coachingExerciseStateSchema.safeParse(result?.exerciseState);
      if (operation.status !== "completed" || !parsed.success || !result) { previous = undefined; continue; }
      const state = parsed.data; const answer = typeof result.transcript === "string" ? result.transcript : "";
      if (previous?.phase === "awaiting_answer" && previous.question && state.revision === previous.revision + 1 && !result.choice && substantiveAnswer(answer)) {
        const queue = session.contextSnapshot.selectedQuestionQueueContext ?? (session.contextSnapshot.selectedQuestionContext ? [session.contextSnapshot.selectedQuestionContext] : []);
        const queued = queue[previous.primaryQuestionIndex - 1];
        const identity = createHash("sha256").update(normalized(previous.question.text)).digest("hex");
        const seen = encounters.get(identity);
        const classification = previous.attemptIndex > 1 ? "guided_retry" : seen && seen !== session.id ? "repeated" : "initial";
        encounters.set(identity, session.id);
        const review = input.reviews.find(row => row.sessionId === session.id && row.userId === session.userId && row.turnIndex === operation.turnIndex && row.answerTranscript === answer && normalized(row.question) === normalized(previous!.question!.text) && row.evaluationSource === "provider" && row.aiRunId && row.evaluatorModel && row.evaluatorPromptVersion > 0);
        const sessionReview = input.evaluations.find(row => row.sessionId === session.id && row.userId === session.userId && row.status === "completed" && row.evaluationSource === "provider" && row.model && row.promptConfigKey && row.promptConfigVersion);
        // Session-wide advice is attributable only when its saved exact evidence
        // occurs in this answer. Generic summaries never become answer findings.
        const anchored = sessionReview?.result.scores.find(score => score.evidence && score.evidence.trim().length >= 8 && answer.includes(score.evidence.trim()) && score.nextStep && input.operations.filter(row => row.targetId === session.id && row.userId === session.userId && row.status === "completed" && typeof row.result?.transcript === "string" && row.result.transcript.includes(score.evidence!.trim())).length === 1);
        const finding = review?.evaluationJson.result ?? anchored?.summary; const advice = review?.evaluationJson.tightenUpAdvice ?? (anchored?.nextStep ? [anchored.nextStep] : undefined);
        const skill = review?.targetSkill || queued?.targetSkill || (typeof result.targetSkill === "string" ? result.targetSkill : "");
        const category = (storyCategories as readonly string[]).includes(skill) ? skill : "general";
        sessionAttempts.push({ id: operation.id, sessionId: session.id, turnIndex: operation.turnIndex, date: operation.createdAt.toISOString(), question: previous.question.text, answer, classification, category,
          evidence: { sessionId: session.id, attemptId: operation.id, turnIndex: operation.turnIndex },
          ...((review || anchored) && typeof finding === "string" && Array.isArray(advice) && typeof advice[0] === "string" ? { review: { finding, improvement: advice[0], model: review?.evaluatorModel ?? sessionReview!.model, rubric: review ? `${review.evaluatorPromptKey}@${review.evaluatorPromptVersion}` : `${sessionReview!.promptConfigKey}@${sessionReview!.promptConfigVersion}` } } : {}) });
      }
      previous = state;
    }
    if (!inRange) continue;
    const hasArtifactAnswer = session.voiceArtifact?.transcript.some(turn => turn.role === "user" && substantiveAnswer(turn.text));
    if (sessionAttempts.length || hasArtifactAnswer) counts.sessions++;
    if (sessionAttempts.some(attempt => attempt.classification !== "guided_retry")) counts.independentSessions++;
    if (!sessionAttempts.length && hasArtifactAnswer) counts.unclassifiedSessions++;
    counts.initialAnswers += sessionAttempts.filter(attempt => attempt.classification !== "guided_retry").length;
    counts.subsequentAttempts += sessionAttempts.filter(attempt => attempt.classification === "guided_retry").length;
    counts.repeatedAnswers += sessionAttempts.filter(attempt => attempt.classification === "repeated").length;
    attempts.push(...sessionAttempts);
    const evaluation = input.evaluations.find(row => row.sessionId === session.id && row.userId === session.userId && row.status === "completed");
    if (evaluation) {
      const assistance = sessionAttempts.length ? sessionAttempts.some(attempt => attempt.classification === "guided_retry") ? "guided" : "independent" : "unknown";
      const comparable = evaluation.evaluationSource === "provider" && assistance === "independent" && Boolean(evaluation.model && evaluation.promptConfigKey && evaluation.promptConfigVersion);
      const rubric = evaluation.promptConfigKey && evaluation.promptConfigVersion ? `${evaluation.promptConfigKey}@${evaluation.promptConfigVersion}` : "Unknown rubric";
      const targetId = session.contextSnapshot.interviewContext.jobTargetId ?? null;
      quality.push({ sessionId: session.id, date: session.createdAt.toISOString(), mode: session.modeKey, model: evaluation.model, rubric, targetId, assistance, comparable, explanation: comparable ? "Matching independent results only; at least three sessions are required for a trend." : "Not comparable: missing lineage, unverified evaluation source, or guided assistance.", group: JSON.stringify([session.modeKey, rubric, evaluation.model, targetId, assistance]), scores: evaluation.result.scores.filter(score => ["clarity", "relevance", "structure", "specificity", "confidence", "conciseness"].includes(score.key) && Number.isFinite(score.score)).map(({ key, label, score }) => ({ key, label, score })) });
    }
  }
  attempts.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const groups = new Map<string, typeof quality>();
  for (const item of quality.filter(item => item.comparable && item.scores.length)) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  return { ...filter, allTargets: Boolean(filter.allTargets), counts, attempts, quality,
    categories: [...storyCategories, "general"].map(key => { const relevant = attempts.filter(attempt => attempt.category === key); return { key, label: categoryLabel(key), answers: relevant.length, sessions: new Set(relevant.map(attempt => attempt.sessionId)).size, recent: relevant.slice(0, 3) }; }),
    trends: [...groups].filter(([, results]) => new Set(results.map(row => row.sessionId)).size >= 3).map(([group, results]) => ({ group, label: `${results[0].mode} · ${results[0].model} · ${results[0].rubric} · independent`, sessionIds: results.map(row => row.sessionId), results: results.map(({ sessionId, date, scores }) => ({ sessionId, date, scores })) })),
    notes: ["Coverage is practice, not a competency score. Topics and answer qualities are separate.", "A session counts once after an answer of at least eight words is saved. Guided retries are separate from initial answers and independent performance.", "Repeated questions are identified across earlier sessions. No improvement percentage or historical rescoring is applied.", "Mixed rubric/model/mode/target or assistance results are not comparable. Fewer than three matching independent sessions show individual results only.", "Legacy records with unknown provenance remain in History. Inspector, simulation, test-tunnel and synthetic records cannot support these claims.", "Realtime answers without verified attempt lineage count as unclassified sessions, not independent performance. Heuristic and unreviewed candidate feedback is excluded."] };
}
