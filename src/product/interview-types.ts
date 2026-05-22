export type AppView =
  | "home"
  | "practice"
  | "stories"
  | "me"
  | "onboarding"
  | "session";

export type InterviewContext = {
  jobDescription: string;
  preferredName: string;
  resumeName?: string;
  targetCompany: string;
  targetRole: string;
};

export type PracticeStep = "mode" | "question" | "style" | "ready";

export type PracticeModeKey =
  | "first_impression"
  | "coaching"
  | "rapid_fire"
  | "mock_interview";

export type QuestionTypeKey =
  | "behavioral"
  | "technical"
  | "hypothetical"
  | "motivational";

export type InterviewStyleKey = "friendly" | "neutral" | "tough";

export type PracticeMode = {
  description: string;
  key: PracticeModeKey;
  name: string;
  questionTypeRequired: boolean;
  use: string;
};

export type QuestionType = {
  key: QuestionTypeKey;
  label: string;
};

export type InterviewStyle = {
  description: string;
  key: InterviewStyleKey;
  label: string;
};

export type SessionSetupSnapshot = {
  interviewContext: InterviewContext;
  modeKey: PracticeModeKey;
  questionTypeKey?: QuestionTypeKey;
  styleKey: InterviewStyleKey;
};
