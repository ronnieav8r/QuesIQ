import { coachingExerciseStateSchema } from "./execution";
import type { CoachingAttempt } from "./index";

/** Read-only projection of persisted controller transitions, never assistant prose. */
export function deriveCoachingAttempts(input: {
  targetId: string;
  rows: Array<{ id: string; turnIndex: number; status: string; result: Record<string, unknown> | null }>;
  promptProfile: CoachingAttempt["promptProfile"];
  model?: string;
  promptVersions?: CoachingAttempt["promptVersions"];
}): CoachingAttempt[] {
  const attempts: CoachingAttempt[] = [];
  let previous: ReturnType<typeof coachingExerciseStateSchema.parse> | undefined;
  for (const row of [...input.rows].sort((a, b) => a.turnIndex - b.turnIndex)) {
    const result = row.result;
    const parsed = coachingExerciseStateSchema.safeParse(result?.exerciseState);
    if (row.status !== "completed" || !result || !parsed.success) { previous = undefined; continue; }
    const state = parsed.data;
    const answer = typeof result.transcript === "string" ? result.transcript : "";
    if (previous?.phase === "awaiting_answer" && state.phase === "awaiting_choice" &&
      state.revision === previous.revision + 1 && !result.choice && answer.trim() &&
      state.question?.id === previous.question?.id && state.attemptIndex === previous.attemptIndex && state.question) {
      const candidate = result.candidateFeedback as { priorityImprovement?: unknown; evidence?: unknown } | undefined;
      const evidence = Array.isArray(candidate?.evidence) ? candidate.evidence.flatMap((item: { quote?: unknown; start?: unknown; end?: unknown } | null) =>
        item && typeof item.quote === "string" && item.quote.trim() && Number.isInteger(item.start) && Number.isInteger(item.end) &&
        Number(item.start) >= 0 && Number(item.end) <= answer.length && Number(item.end) > Number(item.start) && answer.slice(Number(item.start), Number(item.end)) === item.quote
          ? [{ quote: item.quote, start: Number(item.start), end: Number(item.end) }] : []) : [];
      attempts.push({ id: row.id, questionId: `${input.targetId}:${state.question.id}`, question: state.question.text,
        attemptIndex: state.attemptIndex, answer, feedback: typeof result.feedback === "string" ? result.feedback : "",
        assisted: state.attemptIndex > 1, promptProfile: input.promptProfile, model: input.model,
        promptVersions: input.promptVersions ?? [], semanticQuality: "unreviewed", evidence,
        ...(typeof candidate?.priorityImprovement === "string" ? { priority: candidate.priorityImprovement } : {}) });
    }
    previous = state;
  }
  return attempts;
}
