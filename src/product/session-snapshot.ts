import type {
  InterviewStyleKey,
  PracticeModeKey,
  QuestionTypeKey,
  SessionSetupSnapshot,
} from "@/product/interview-types";
import { parseStoryOutline } from "@/product/story-lab";

const modeKeys: PracticeModeKey[] = [
  "first_impression",
  "coaching",
  "rapid_fire",
  "mock_interview",
];
const questionTypeKeys: QuestionTypeKey[] = [
  "behavioral",
  "technical",
  "hypothetical",
  "motivational",
];
const styleKeys: InterviewStyleKey[] = ["friendly", "neutral", "tough"];

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function parseStoryContext(value: unknown): SessionSetupSnapshot["storyContext"] {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const storyId = (value as { storyId?: unknown }).storyId;
  const outline = parseStoryOutline(value);

  if (!isString(storyId) || !outline) {
    return undefined;
  }

  return {
    ...outline,
    storyId,
  };
}

export function parseSessionSetupSnapshot(value: unknown): SessionSetupSnapshot | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<SessionSetupSnapshot>;
  const context = candidate.interviewContext;

  if (
    !context ||
    typeof context !== "object" ||
    !isString(context.jobDescription) ||
    !isString(context.preferredName) ||
    !isString(context.targetCompany) ||
    !isString(context.targetRole) ||
    !candidate.modeKey ||
    !modeKeys.includes(candidate.modeKey) ||
    !candidate.styleKey ||
    !styleKeys.includes(candidate.styleKey)
  ) {
    return undefined;
  }

  if (
    candidate.questionTypeKey !== undefined &&
    !questionTypeKeys.includes(candidate.questionTypeKey)
  ) {
    return undefined;
  }

  return {
    interviewContext: {
      jobDescription: context.jobDescription,
      preferredName: context.preferredName,
      resumeParsedAt: isString(context.resumeParsedAt) ? context.resumeParsedAt : undefined,
      resumeName: isString(context.resumeName) ? context.resumeName : undefined,
      resumeText: isString(context.resumeText) ? context.resumeText : undefined,
      targetCompany: context.targetCompany,
      targetRole: context.targetRole,
    },
    modeKey: candidate.modeKey,
    questionTypeKey: candidate.questionTypeKey,
    storyContext: parseStoryContext(candidate.storyContext),
    styleKey: candidate.styleKey,
  };
}
