import type { SessionSetupSnapshot, VoiceSessionArtifactDraft } from "@/product/interview-types";

/** Conservative legacy fallback: an exact queued question immediately precedes
 * a substantive answer. Never treat every queued question as answered. */
export function attributableQueuedAnswers(snapshot: SessionSetupSnapshot, artifact: VoiceSessionArtifactDraft) {
  const queue = snapshot.selectedQuestionQueueContext ?? (snapshot.selectedQuestionContext ? [snapshot.selectedQuestionContext] : []);
  const counts = new Map<string, number>(); let pending: string | undefined;
  for (const turn of artifact.transcript) {
    if (turn.role === "assistant") pending = queue.find(question => question.questionText.trim() === turn.text.trim())?.id;
    else if (turn.role === "user" && pending) {
      if (turn.text.trim().split(/\s+/).filter(Boolean).length >= 8) counts.set(pending, (counts.get(pending) ?? 0) + 1);
      pending = undefined;
    }
  }
  return Array.from(counts, ([questionId, count]) => ({ questionId, retryCount: count - 1 }));
}
