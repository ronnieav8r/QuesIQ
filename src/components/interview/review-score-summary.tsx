import type { CSSProperties } from "react";

import type { SessionEvaluationResult } from "@/product/interview-types";
import { getOverallScore } from "@/product/scoring";

type ReviewScoreSummaryProps = {
  evaluation: SessionEvaluationResult;
};

function clampScore(score: number) {
  return Math.max(0, Math.min(5, score));
}

function scorePercent(score: number) {
  return Math.round((clampScore(score) / 5) * 100);
}

export function ReviewScoreSummary({ evaluation }: ReviewScoreSummaryProps) {
  const overallScore = getOverallScore(evaluation.scores);
  const overallPercent = overallScore === undefined ? 0 : scorePercent(overallScore);

  return (
    <div className="review-score-summary">
      <div
        aria-label={
          overallScore === undefined
            ? "Overall score unavailable"
            : `Overall score ${overallScore.toFixed(1)} out of 5`
        }
        className="review-score-ring"
        style={{ "--score-percent": `${overallPercent}%` } as CSSProperties}
      >
        <strong>{overallScore === undefined ? "--" : overallScore.toFixed(1)}</strong>
        <span>Overall</span>
      </div>
      <div className="review-score-bars">
        {evaluation.scores.map((score) => (
          <div className={`review-score-bar score-${score.key}`} key={score.key}>
            <div>
              <strong>{score.label}</strong>
              <span>{score.score.toFixed(1)}/5</span>
            </div>
            <i aria-hidden="true">
              <span style={{ width: `${scorePercent(score.score)}%` }} />
            </i>
            <small>{score.summary}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
