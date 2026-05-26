import type { SessionDebriefResult } from "@/product/interview-types";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function parseSessionDebriefResult(
  value: unknown,
): SessionDebriefResult | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<SessionDebriefResult>;

  if (
    typeof candidate.followUpQuestion !== "string" ||
    !isStringArray(candidate.focusAreas) ||
    !isStringArray(candidate.practicePlan) ||
    !isStringArray(candidate.strengths) ||
    typeof candidate.summary !== "string"
  ) {
    return undefined;
  }

  return {
    followUpQuestion: candidate.followUpQuestion,
    focusAreas: candidate.focusAreas,
    practicePlan: candidate.practicePlan,
    strengths: candidate.strengths,
    summary: candidate.summary,
  };
}
