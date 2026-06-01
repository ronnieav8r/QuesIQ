import type {
  InterviewStyleKey,
  PracticeModeKey,
  QuestionTypeKey,
  SessionSetupSnapshot,
  IntroAudience,
  IntroLength,
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
const introAudiences: IntroAudience[] = ["hr_phone", "in_person", "virtual"];
const introLengths: IntroLength[] = ["long", "medium", "short"];

function parseTurnBasedQuestionCount(value: unknown) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return undefined;
  }

  return Math.max(1, Math.min(10, parsed));
}

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

function parseIntroductionContext(
  value: unknown,
): SessionSetupSnapshot["introductionContext"] {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const introductionId = candidate.introductionId;
  const id = candidate.id;
  const audience = candidate.audience;
  const length = candidate.length;

  if (
    !isString(introductionId) ||
    !isString(id) ||
    !introAudiences.includes(audience as IntroAudience) ||
    !introLengths.includes(length as IntroLength) ||
    !isString(candidate.title) ||
    !isString(candidate.script)
  ) {
    return undefined;
  }

  return {
    audience: audience as IntroAudience,
    background: isString(candidate.background) ? candidate.background : "",
    createdAt: isString(candidate.createdAt) ? candidate.createdAt : new Date().toISOString(),
    id,
    introductionId,
    lastPracticedAt: isString(candidate.lastPracticedAt)
      ? candidate.lastPracticedAt
      : undefined,
    length: length as IntroLength,
    practiceCoaching: [],
    practiceCount:
      typeof candidate.practiceCount === "number" ? candidate.practiceCount : 0,
    proofPoint: isString(candidate.proofPoint) ? candidate.proofPoint : "",
    rawNotes: isString(candidate.rawNotes) ? candidate.rawNotes : "",
    roleInterest: isString(candidate.roleInterest) ? candidate.roleInterest : "",
    script: candidate.script,
    strength: isString(candidate.strength) ? candidate.strength : "",
    title: candidate.title,
    transition: isString(candidate.transition) ? candidate.transition : "",
    updatedAt: isString(candidate.updatedAt) ? candidate.updatedAt : new Date().toISOString(),
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
      jobTargetId: isString(context.jobTargetId) ? context.jobTargetId : undefined,
      preferredName: context.preferredName,
      resumeParsedAt: isString(context.resumeParsedAt) ? context.resumeParsedAt : undefined,
      resumeName: isString(context.resumeName) ? context.resumeName : undefined,
      resumeText: isString(context.resumeText) ? context.resumeText : undefined,
      targetCompany: context.targetCompany,
      targetRole: context.targetRole,
    },
    introductionContext: parseIntroductionContext(candidate.introductionContext),
    modeKey: candidate.modeKey,
    questionTypeKey: candidate.questionTypeKey,
    rapidFireQuestionCount:
      candidate.modeKey === "rapid_fire"
        ? parseTurnBasedQuestionCount(candidate.rapidFireQuestionCount)
        : undefined,
    turnBasedQuestionCount:
      candidate.modeKey === "rapid_fire" || candidate.modeKey === "coaching"
        ? parseTurnBasedQuestionCount(
            candidate.turnBasedQuestionCount ?? candidate.rapidFireQuestionCount,
          )
        : undefined,
    storyContext: parseStoryContext(candidate.storyContext),
    styleKey: candidate.styleKey,
  };
}
