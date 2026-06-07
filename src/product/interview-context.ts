import type { InterviewContext } from "@/product/interview-types";
import { parseInterviewResumeSummary } from "@/product/resume-summary";

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
    jobTargetId: isString(candidate.jobTargetId) ? candidate.jobTargetId : undefined,
    preferredName: candidate.preferredName,
    resumeParsedAt: isString(candidate.resumeParsedAt) ? candidate.resumeParsedAt : undefined,
    resumeName: isString(candidate.resumeName) ? candidate.resumeName : undefined,
    resumeSummary: parseInterviewResumeSummary(candidate.resumeSummary),
    resumeText: isString(candidate.resumeText) ? candidate.resumeText : undefined,
    targetCompany: candidate.targetCompany,
    targetRole: candidate.targetRole,
  };
}
