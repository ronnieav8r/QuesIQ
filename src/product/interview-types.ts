export type AppView =
  | "home"
  | "practice"
  | "review"
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

export type SessionHistoryItem = {
  createdAt: string;
  endedAt?: string;
  evaluation?: SessionEvaluationResult;
  evaluationError?: string;
  evaluationStatus: EvaluationStatus;
  hasEvaluation: boolean;
  id: string;
  modeKey: PracticeModeKey;
  questionTypeKey?: QuestionTypeKey;
  status: SessionStatus;
  styleKey: InterviewStyleKey;
  targetCompany: string;
  targetRole: string;
  transcript: VoiceTranscriptTurn[];
};

export type SessionStatus = "artifact_saved" | "created" | "evaluated";

export type EvaluationStatus =
  | "completed"
  | "failed"
  | "not_started"
  | "pending"
  | "processing";

export type EvaluationScoreKey =
  | "confidence"
  | "clarity"
  | "relevance"
  | "impact"
  | "authenticity";

export type EvaluationScore = {
  key: EvaluationScoreKey;
  label: string;
  score: number;
  summary: string;
};

export type SessionEvaluationResult = {
  coachingInsight: string;
  nextAction: string;
  scores: EvaluationScore[];
  summary: string;
};

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
