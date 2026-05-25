export type AppView =
  | "admin"
  | "home"
  | "history"
  | "practice"
  | "review"
  | "stories"
  | "me"
  | "onboarding"
  | "session";

export type FeedbackKind = "bug" | "feedback";

export type FeedbackRecord = {
  browserLanguage?: string;
  createdAt: string;
  id: string;
  kind: FeedbackKind;
  message?: string;
  rating?: number;
  screen: AppView | string;
  sessionId?: string;
  status: "new" | "reviewed" | "resolved";
  userAgent?: string;
  userEmail?: string;
  userId?: string;
  viewport?: string;
};

export type InterviewContext = {
  jobDescription: string;
  preferredName: string;
  resumeName?: string;
  resumeParsedAt?: string;
  resumeText?: string;
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
  displayOrder?: number;
  key: PracticeModeKey;
  name: string;
  promptInstructions?: string;
  questionTypeRequired: boolean;
  use: string;
};

export type QuestionType = {
  displayOrder?: number;
  key: QuestionTypeKey;
  label: string;
  promptInstructions?: string;
};

export type InterviewStyle = {
  description: string;
  displayOrder?: number;
  key: InterviewStyleKey;
  label: string;
  promptInstructions?: string;
};

export type InterviewCatalog = {
  interviewStyles: InterviewStyle[];
  practiceModes: PracticeMode[];
  questionTypes: QuestionType[];
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
  durationSeconds?: number;
  endedAt?: string;
  endReason?: "connection_lost" | "start_failed" | "user_ended";
  events: VoiceSessionEvent[];
  startedAt?: string;
  transcript: VoiceTranscriptTurn[];
};

export type PromptConfigKey = "realtime_interviewer" | "session_evaluation";

export type PromptConfigTarget = "evaluation" | "realtime";

export type PromptConfigRecord = {
  active: boolean;
  createdAt: string;
  id: string;
  instructions: string;
  key: PromptConfigKey;
  model: string;
  name: string;
  target: PromptConfigTarget;
  updatedAt: string;
  version: number;
  voice?: string;
};

export type PromptComponentRecord = {
  description?: string;
  displayName: string;
  key: string;
  promptInstructions: string;
  type: "mode" | "question_type" | "style";
};

export type AiRunRecord = {
  completedAt?: string;
  costSource: "estimated" | "exact" | "unavailable";
  durationMs?: number;
  errorMessage?: string;
  estimatedCostMicroUsd?: number;
  id: string;
  inputAudioTokens?: number;
  inputTokens?: number;
  model: string;
  outputAudioTokens?: number;
  outputTokens?: number;
  promptConfigKey?: string;
  promptConfigVersion?: number;
  provider: "openai";
  providerRequestId?: string;
  runType: "evaluation" | "pricing_review" | "realtime";
  sessionId?: string;
  startedAt: string;
  status: "failed" | "started" | "succeeded";
  totalTokens?: number;
  userEmail?: string;
  userId?: string;
};

export type RealtimeSessionUsageRecord = {
  assistantTranscriptCharacters: number;
  durationSeconds: number;
  endedAt?: string;
  estimatedAudioInputTokens: number;
  estimatedAudioOutputTokens: number;
  estimatedCostMicroUsd: number;
  estimationMethod: string;
  id: string;
  model: string;
  pricingVersion: string;
  promptConfigKey?: string;
  promptConfigVersion?: number;
  realtimeCallId?: string;
  sessionId: string;
  startedAt?: string;
  transcriptTurns: number;
  userEmail?: string;
  userId?: string;
  userTranscriptCharacters: number;
  voice?: string;
};

export type AiPricingRecord = {
  active: boolean;
  cachedInputMicroUsdPerMillion?: number;
  createdAt: string;
  id: string;
  inputMicroUsdPerMillion: number;
  model: string;
  modality: "audio" | "text";
  outputMicroUsdPerMillion?: number;
  provider: "openai";
  sourceUrl: string;
  unit: "per_1m_tokens";
  updatedAt: string;
  version: string;
};

export type PricingCheckRecord = {
  checkedAt: string;
  detectedChange: boolean;
  id: string;
  sourceHash?: string;
  sourceUrl: string;
  status: "failed" | "succeeded";
  summary: string;
};

export type PricingReviewResult = {
  changes: Array<{
    field: string;
    model: string;
    modality: "audio" | "text";
    newValue?: number;
    oldValue?: number;
    verified: boolean;
  }>;
  pricing: Array<{
    cachedInputUsdPerMillion?: number;
    inputUsdPerMillion: number;
    model: string;
    modality: "audio" | "text";
    outputUsdPerMillion?: number;
    sourceUrl: string;
    verified: boolean;
  }>;
  report: string;
  sourceUrls: string[];
  status: "changes_detected" | "no_changes" | "source_unavailable";
};

export type PricingReviewRecord = {
  acceptedAt?: string;
  appliedPricingUpdates: number;
  completedAt?: string;
  createdAt: string;
  errorMessage?: string;
  id: string;
  model: string;
  providerRequestId?: string;
  result?: PricingReviewResult;
  status: "failed" | "processing" | "succeeded";
};
