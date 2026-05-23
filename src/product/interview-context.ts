import type { InterviewContext } from "@/product/interview-types";

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function parseInterviewContext(value: unknown): InterviewContext | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<InterviewContext>;

  if (
    !isString(candidate.jobDescription) ||
    !isString(candidate.preferredName) ||
    !isString(candidate.targetCompany) ||
    !isString(candidate.targetRole)
  ) {
    return undefined;
  }

  return {
    jobDescription: candidate.jobDescription,
    preferredName: candidate.preferredName,
    resumeName: isString(candidate.resumeName) ? candidate.resumeName : undefined,
    targetCompany: candidate.targetCompany,
    targetRole: candidate.targetRole,
  };
}
