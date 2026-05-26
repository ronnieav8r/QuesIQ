import type { EvaluationScore, SessionEvaluationResult } from "@/product/interview-types";

export function getOverallScore(scores: EvaluationScore[]) {
  if (scores.length === 0) {
    return undefined;
  }

  return scores.reduce((sum, score) => sum + score.score, 0) / scores.length;
}

export function withOverallScore(evaluation: SessionEvaluationResult) {
  const overall = getOverallScore(evaluation.scores);

  return overall === undefined
    ? evaluation.scores
    : [
        {
          key: "overall" as const,
          label: "Overall",
          score: overall,
          summary: "Average across all scored dimensions.",
        },
        ...evaluation.scores,
      ];
}
