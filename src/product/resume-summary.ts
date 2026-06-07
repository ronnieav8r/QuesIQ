import type { InterviewResumeSummary } from "@/product/interview-types";

function stringArray(value: unknown, limit = 12) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, limit)
    : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function parseInterviewResumeSummary(
  value: unknown,
): InterviewResumeSummary | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const stories = Array.isArray(candidate.likelyBehavioralStories)
    ? candidate.likelyBehavioralStories
        .filter((story): story is Record<string, unknown> => Boolean(story) && typeof story === "object")
        .slice(0, 8)
        .map((story) => {
          const hints =
            story.starElementHints && typeof story.starElementHints === "object"
              ? (story.starElementHints as Record<string, unknown>)
              : {};

          return {
            evidence: stringValue(story.evidence),
            likelyQuestionTypes: stringArray(story.likelyQuestionTypes, 8),
            starElementHints: {
              action: stringValue(hints.action) || undefined,
              result: stringValue(hints.result) || undefined,
              situation: stringValue(hints.situation) || undefined,
              task: stringValue(hints.task) || undefined,
            },
            title: stringValue(story.title),
          };
        })
        .filter((story) => story.title || story.evidence)
    : [];

  return {
    currentOrRecentRole: stringValue(candidate.currentOrRecentRole),
    gapsOrAreasToProbe: stringArray(candidate.gapsOrAreasToProbe),
    generatedAt: stringValue(candidate.generatedAt) || new Date().toISOString(),
    keySkills: stringArray(candidate.keySkills),
    likelyBehavioralStories: stories,
    quantifiedWins: stringArray(candidate.quantifiedWins),
    relevantIndustries: stringArray(candidate.relevantIndustries),
    sourceResumeName: stringValue(candidate.sourceResumeName) || undefined,
    sourceResumeParsedAt: stringValue(candidate.sourceResumeParsedAt) || undefined,
    strongestExperience: stringArray(candidate.strongestExperience),
    targetCompany: stringValue(candidate.targetCompany) || undefined,
    targetRole: stringValue(candidate.targetRole) || undefined,
    targetRoleAlignment: stringValue(candidate.targetRoleAlignment),
  };
}
