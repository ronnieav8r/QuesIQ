import type {
  CoachingMemorySnapshot,
  EvaluationScore,
  EvaluationScoreKey,
  SessionReviewDetail,
  SessionEvaluationResult,
} from "@/product/interview-types";

const scoreKeys = [
  "confidence",
  "clarity",
  "relevance",
  "impact",
  "authenticity",
] as const satisfies EvaluationScoreKey[];

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isScoreKey(value: unknown): value is EvaluationScoreKey {
  return isString(value) && scoreKeys.includes(value as EvaluationScoreKey);
}

function isEvaluationScore(value: unknown): value is EvaluationScore {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<EvaluationScore>;
  const score = candidate.score;

  return (
    isScoreKey(candidate.key) &&
    isString(candidate.label) &&
    typeof score === "number" &&
    Number.isInteger(score) &&
    score >= 1 &&
    score <= 5 &&
    isString(candidate.summary) &&
    (candidate.evidence === undefined || isString(candidate.evidence)) &&
    (candidate.nextStep === undefined || isString(candidate.nextStep))
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isCoachingMemorySnapshot(value: unknown): value is CoachingMemorySnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CoachingMemorySnapshot>;

  return (
    typeof candidate.evidenceCount === "number" &&
    Number.isInteger(candidate.evidenceCount) &&
    candidate.evidenceCount >= 1 &&
    isStringArray(candidate.growthAreas) &&
    isString(candidate.latestRecommendation) &&
    isStringArray(candidate.recurringPatterns) &&
    isStringArray(candidate.strengths) &&
    isString(candidate.summary)
  );
}

function isSessionReviewDetail(value: unknown): value is SessionReviewDetail {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SessionReviewDetail>;

  return (
    isStringArray(candidate.evidence) &&
    isStringArray(candidate.focusAreas) &&
    isStringArray(candidate.followUpQuestions) &&
    isStringArray(candidate.practicePlan) &&
    isStringArray(candidate.strengths)
  );
}

export function parseSessionEvaluation(
  value: unknown,
): SessionEvaluationResult | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<SessionEvaluationResult>;

  if (
    !isString(candidate.summary) ||
    !isCoachingMemorySnapshot(candidate.coachingMemory) ||
    !isString(candidate.coachingInsight) ||
    !isString(candidate.nextAction) ||
    !Array.isArray(candidate.scores) ||
    candidate.scores.length !== scoreKeys.length ||
    !candidate.scores.every(isEvaluationScore)
  ) {
    return undefined;
  }

  const returnedKeys = new Set(candidate.scores.map((score) => score.key));

  if (!scoreKeys.every((key) => returnedKeys.has(key))) {
    return undefined;
  }

  return {
    coachingMemory: candidate.coachingMemory,
    coachingInsight: candidate.coachingInsight,
    reviewDetail: isSessionReviewDetail(candidate.reviewDetail)
      ? candidate.reviewDetail
      : undefined,
    nextAction: candidate.nextAction,
    scores: candidate.scores,
    summary: candidate.summary,
  };
}
