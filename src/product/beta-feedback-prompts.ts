export const postReviewBetaFeedbackPrompts = [
  "How useful was this practice review?",
  "How realistic did Que's voice interview feel?",
  "How accurate did the transcript look after the session?",
  "How fair did the scoring feel for your answer?",
] as const;

export function getPostReviewFeedbackPrompt(seed: string) {
  const hash = Array.from(seed).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );

  return postReviewBetaFeedbackPrompts[hash % postReviewBetaFeedbackPrompts.length];
}
