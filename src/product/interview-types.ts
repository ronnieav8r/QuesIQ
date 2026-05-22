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

export type SessionLaunchRecord = {
  id: string;
  status: SessionStatus;
};

export type SessionStatus = "created" | "artifact_saved";

export type VoiceSessionPhase =
  | "ready"
  | "requesting_microphone"
  | "connecting"
  | "live"
  | "ended"
  | "error";

export type VoiceTranscriptTurn = {
  createdAt: string;
  id: string;
  role: "assistant" | "user";
  speaker: "Que" | "You";
  text: string;
};

export type VoiceSessionEvent = {
  createdAt: string;
  id: string;
  type: string;
};

export type VoiceSessionArtifactDraft = {
  endedAt?: string;
  endReason?: "connection_lost" | "start_failed" | "user_ended";
  events: VoiceSessionEvent[];
  startedAt?: string;
  transcript: VoiceTranscriptTurn[];
};
