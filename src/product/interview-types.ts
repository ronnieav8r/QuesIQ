export type AppView =
  | "admin"
  | "debrief"
  | "home"
  | "history"
  | "practice"
  | "review"
  | "stories"
  | "me"
  | "onboarding"
  | "session";

export type FeedbackKind = "bug" | "feedback";

export type StoryCategory =
  | "adaptability"
  | "ambiguity"
  | "communication"
  | "conflict"
  | "customer_impact"
  | "failure"
  | "leadership"
  | "learning"
  | "ownership"
  | "problem_solving"
  | "teamwork"
  | "time_management";

export type StorySpin = {
  angle: string;
  question: string;
  whyItWorks: string;
};

export type StoryOutline = {
  actions: string[];
  alternateSpins: StorySpin[];
  categories: StoryCategory[];
  coachNotes: string[];
  practicePrompt: string;
  result: string;
  situation: string;
  summary: string;
  task: string;
  title: string;
};

export type StoryRecord = StoryOutline & {
  createdAt: string;
  id: string;
  lastPracticedAt?: string;
  practiceCoaching: StoryPracticeCoachingEntry[];
  practiceCount: number;
  rawNotes: string;
  updatedAt: string;
};

export type StoryPracticeCoachingEntry = {
  coachingInsight: string;
  nextAction: string;
  practicedAt: string;
  scores: EvaluationScore[];
  sessionId: string;
  summary: string;
};

export type StoryBuilderTurn = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

export type IntroAudience = "hr_phone" | "in_person" | "virtual";

export type IntroLength = "long" | "medium" | "short";

export type IntroductionPracticeCoachingEntry = {
  coachingInsight: string;
  nextAction: string;
  practicedAt: string;
  scores: EvaluationScore[];
  sessionId: string;
  summary: string;
};

export type IntroductionRecord = {
  audience: IntroAudience;
  background: string;
  createdAt: string;
  id: string;
  lastPracticedAt?: string;
  length: IntroLength;
  practiceCoaching: IntroductionPracticeCoachingEntry[];
  practiceCount: number;
  proofPoint: string;
  rawNotes: string;
  roleInterest: string;
  script: string;
  strength: string;
  title: string;
  transition: string;
  updatedAt: string;
};

export type FeedbackRecord = {
  browserLanguage?: string;
  createdAt: string;
  id: string;
  kind: FeedbackKind;
  message?: string;
  ratingPrompt?: string;
  rating?: number;
  screen: AppView | string;
  screenshotDataUrl?: string;
  screenshotMimeType?: string;
  screenshotName?: string;
  screenshotSize?: number;
  sessionId?: string;
  status: "new" | "reviewed" | "resolved";
  userAgent?: string;
  userEmail?: string;
  userId?: string;
  viewport?: string;
};

export type DiagnosticEventSeverity = "error" | "info" | "warning";

export type DiagnosticEventSource = "api" | "client" | "realtime";

export type DiagnosticEventRecord = {
  createdAt: string;
  durationMs?: number;
  endpoint?: string;
  eventType: string;
  id: string;
  message?: string;
  metadata?: Record<string, unknown>;
  method?: string;
  route?: string;
  screen?: string;
  sessionId?: string;
  severity: DiagnosticEventSeverity;
  source: DiagnosticEventSource;
  statusCode?: number;
  userAgent?: string;
  userEmail?: string;
  userId?: string;
  viewport?: string;
};

export type InterviewContext = {
  jobDescription: string;
  jobTargetId?: string;
  preferredName: string;
  resumeName?: string;
  resumeParsedAt?: string;
  resumeText?: string;
  targetCompany: string;
  targetRole: string;
};

export type JobTargetRecord = {
  createdAt: string;
  id: string;
  jobDescription: string;
  label: string;
  lastUsedAt?: string;
  targetCompany: string;
  targetRole: string;
  updatedAt: string;
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
  introductionContext?: IntroductionRecord & {
    introductionId: string;
  };
  modeKey: PracticeModeKey;
  questionTypeKey?: QuestionTypeKey;
  storyContext?: StoryOutline & {
    storyId: string;
  };
  styleKey: InterviewStyleKey;
};

export type SessionLaunchRecord = {
  id: string;
  status: SessionStatus;
};

export type SessionHistoryItem = {
  createdAt: string;
  durationSeconds?: number;
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
  | "processing"
  | "too_short";

export type EvaluationScoreKey =
  | "confidence"
  | "clarity"
  | "relevance"
  | "impact"
  | "authenticity";

export type ProgressionEventType =
  | "debrief_completed"
  | "quest_completed"
  | "resume_uploaded"
  | "review_completed"
  | "xp_rule_awarded";

export type XpRuleConditionType =
  | "always"
  | "duration_min_seconds"
  | "debrief_created"
  | "first_practice_of_day"
  | "overall_score_min"
  | "resume_uploaded";

export type XpRuleEventType = "debrief_completed" | "resume_uploaded" | "review_completed";

export type XpRuleAwardMode = "highest_only" | "stack";

export type ProgressionXpRuleRecord = {
  active: boolean;
  awardMode: XpRuleAwardMode;
  conditionType: XpRuleConditionType;
  conditionValue: number;
  createdAt: string;
  description: string;
  displayOrder: number;
  eventType: XpRuleEventType;
  groupKey: string;
  key: string;
  label: string;
  updatedAt: string;
  xp: number;
};

export type QuestCheckType =
  | "all_modes_used"
  | "all_question_types_used"
  | "all_scores_min"
  | "avg_score_min"
  | "debrief_count"
  | "introduction_count"
  | "job_target_set"
  | "level_reached"
  | "mode_used"
  | "question_type_used"
  | "resume_uploaded"
  | "session_count"
  | "single_score_min"
  | "story_count"
  | "streak_count";

export type UserQuestRecord = {
  category: string;
  checkDimension?: string;
  checkThreshold: number;
  checkType: QuestCheckType;
  completedAt?: string;
  description: string;
  displayOrder: number;
  progress: number;
  questKey: string;
  status: "completed" | "open";
  title: string;
  xpReward: number;
};

export type ProgressionQuestRecord = Omit<
  UserQuestRecord,
  "completedAt" | "progress" | "status"
> & {
  enabled: boolean;
};

export type ProgressionSummaryRecord = {
  completedReviews: number;
  currentLevelXp: number;
  lastPracticedAt?: string;
  latestNextAction?: string;
  level: number;
  longestStreakDays: number;
  nextLevelXp: number;
  streakDays: number;
  totalXp: number;
  updatedAt: string;
  levelName?: string;
  quests?: UserQuestRecord[];
  questsCompleted?: number;
  questsTotal?: number;
  weakestScoreAverage?: number;
  weakestScoreKey?: EvaluationScoreKey;
  weakestScoreLabel?: string;
};

export type AdminProgressionSummaryRecord = ProgressionSummaryRecord & {
  userEmail?: string;
  userId: string;
};

export type ProgressionEventRecord = {
  createdAt: string;
  eventType: ProgressionEventType;
  id: string;
  metadata?: Record<string, unknown>;
  occurredAt: string;
  sessionId?: string;
  userEmail?: string;
  userId: string;
  xp: number;
};

export type ProgressionLevelThresholdRecord = {
  createdAt: string;
  level: number;
  minTotalXp: number;
  name: string;
  updatedAt: string;
};

export type AdminUserRecord = {
  email?: string;
  emailVerified?: string;
  id: string;
  image?: string;
  name?: string;
};

export type AdminProfileRecord = {
  preferredName: string;
  resumeName?: string;
  targetCompany: string;
  targetRole: string;
  updatedAt: string;
  userEmail?: string;
  userId: string;
};

export type AdminSessionRecord = {
  createdAt: string;
  evaluationStatus: EvaluationStatus;
  id: string;
  modeKey: string;
  questionTypeKey?: string;
  status: SessionStatus;
  styleKey: string;
  targetRole: string;
  transcriptTurns: number;
  userEmail?: string;
  userId?: string;
};

export type AdminEvaluationRecord = {
  averageScore: number;
  createdAt: string;
  id: string;
  model: string;
  sessionId: string;
  status: string;
  summary: string;
  targetRole: string;
  userEmail?: string;
  userId?: string;
};

export type EvaluationScore = {
  evidence?: string;
  key: EvaluationScoreKey;
  label: string;
  nextStep?: string;
  score: number;
  summary: string;
};

export type SessionReviewDetail = {
  evidence: string[];
  focusAreas: string[];
  followUpQuestions: string[];
  practicePlan: string[];
  strengths: string[];
};

export type SessionEvaluationResult = {
  coachingMemory?: CoachingMemorySnapshot;
  coachingInsight: string;
  reviewDetail?: SessionReviewDetail;
  nextAction: string;
  scores: EvaluationScore[];
  summary: string;
};

export type CoachingMemorySnapshot = {
  evidenceCount: number;
  growthAreas: string[];
  latestRecommendation: string;
  recurringPatterns: string[];
  strengths: string[];
  summary: string;
};

export type CoachingMemoryRecord = CoachingMemorySnapshot & {
  createdAt: string;
  lastSessionId?: string;
  updatedAt: string;
};

export type SessionDebriefResult = {
  followUpQuestion: string;
  focusAreas: string[];
  practicePlan: string[];
  strengths: string[];
  summary: string;
};

export type SessionDebriefRecord = {
  createdAt: string;
  id: string;
  model: string;
  result: SessionDebriefResult;
  sessionId: string;
  targetCompany: string;
  targetRole: string;
  updatedAt: string;
  userNote: string;
};

export type VoiceDebriefStatus = "completed";

export type VoiceDebriefRecord = {
  createdAt: string;
  durationSeconds: number;
  endedAt?: string;
  id: string;
  model: string;
  promptConfigKey?: string;
  promptConfigVersion?: number;
  sessionId: string;
  startedAt?: string;
  status: VoiceDebriefStatus;
  transcript: VoiceTranscriptTurn[];
  updatedAt: string;
  voice?: string;
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

export type PromptConfigKey =
  | "introduction_draft"
  | "session_debrief"
  | "realtime_interviewer"
  | "session_evaluation"
  | "story_conversation_realtime"
  | "story_follow_up"
  | "story_outline"
  | "story_practice_evaluation"
  | "story_practice_realtime";

export type PromptConfigTarget = "debrief" | "evaluation" | "realtime" | "story";

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
  promptConfigId?: string;
  promptConfigKey?: string;
  promptConfigVersion?: number;
  promptSnapshot?: string;
  provider: "openai";
  providerRequestId?: string;
  rawJson?: Record<string, unknown>;
  runType:
    | "debrief"
    | "dpe_review"
    | "evaluation"
    | "introduction_draft"
    | "pricing_review"
    | "realtime"
    | "study_evaluate"
    | "study_import"
    | "study_tts"
    | "story_follow_up"
    | "story_outline";
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
