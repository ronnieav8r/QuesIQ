import { z } from "zod";
import { interviewExecutionConfigSchema } from "./execution";
export * from "./execution";

export const practiceModeKeySchema = z.enum([
  "first_impression",
  "coaching",
  "rapid_fire",
  "mock_interview",
]);
export const questionTypeKeySchema = z.enum([
  "behavioral",
  "technical",
  "hypothetical",
  "motivational",
]);
export const interviewStyleKeySchema = z.enum(["friendly", "neutral", "tough"]);
export const coachingChoiceIntentSchema = z.enum([
  "more_feedback",
  "try_again",
  "ask_que",
  "move_on",
]);

export const interviewContextSchema = z.object({
  jobDescription: z.string(),
  jobTargetId: z.string().optional(),
  preferredName: z.string(),
  resumeName: z.string().optional(),
  resumeParsedAt: z.string().optional(),
  targetCompany: z.string(),
  targetRole: z.string(),
});

export const sessionSetupSnapshotSchema = z.object({
  interviewContext: interviewContextSchema,
  modeKey: practiceModeKeySchema,
  questionTypeKey: questionTypeKeySchema.optional(),
  rapidFireQuestionCount: z.number().int().min(1).max(10).optional(),
  styleKey: interviewStyleKeySchema,
  turnBasedQuestionCount: z.number().int().min(1).max(10).optional(),
  executionConfig: z.lazy(() => interviewExecutionConfigSchema).optional(),
});

export const voiceTranscriptTurnSchema = z.object({
  answerDurationSeconds: z.number().nonnegative().optional(),
  createdAt: z.string(),
  id: z.string(),
  role: z.enum(["assistant", "user"]),
  speaker: z.enum(["Que", "You"]),
  text: z.string(),
  wordCount: z.number().int().nonnegative().optional(),
  wordsPerMinute: z.number().int().nonnegative().optional(),
});

export const voiceSessionEventSchema = z.object({
  createdAt: z.string(),
  id: z.string(),
  type: z.string(),
});

export const voiceSessionArtifactSchema = z.object({
  durationSeconds: z.number().nonnegative().optional(),
  endedAt: z.string(),
  endReason: z.enum(["connection_lost", "start_failed", "user_ended"]).optional(),
  events: z.array(voiceSessionEventSchema),
  startedAt: z.string().optional(),
  transcript: z.array(voiceTranscriptTurnSchema),
});

export const chainedCoachingTurnSchema = z.object({
  done: z.boolean(),
  feedback: z.string().optional(),
  feedbackAudioBase64: z.string().optional(),
  feedbackAudioMimeType: z.string().optional(),
  question: z.string().optional(),
  questionAudioBase64: z.string().optional(),
  questionAudioMimeType: z.string().optional(),
  state: z.enum([
    "opening_question",
    "awaiting_answer",
    "brief_feedback_choice",
    "more_feedback",
    "retry_answer",
    "move_on",
    "wrap_up",
  ]).optional(),
  transcript: z.string().optional(),
  turnId: z.string().optional(),
  validation: z.object({
    corrected: z.boolean(),
    issues: z.array(z.string()),
    passed: z.boolean(),
  }),
  pipeline: z.object({
    completedAt: z.string(),
    responseAndSpeechMs: z.number().nonnegative(),
    textModel: z.string(),
    transcriptionModel: z.string(),
    ttsModel: z.string(),
    ttsVoice: z.string(),
  }),
});

export const evaluationScoreSchema = z.object({
  evidence: z.string().optional(),
  key: z.enum(["confidence", "clarity", "relevance", "impact", "authenticity"]),
  label: z.string(),
  nextStep: z.string().optional(),
  score: z.number().int().min(1).max(5),
  summary: z.string(),
});

export const sessionReviewSchema = z.object({
  coachingInsight: z.string(),
  nextAction: z.string(),
  reviewDetail: z.object({
    evidence: z.array(z.string()),
    focusAreas: z.array(z.string()),
    followUpQuestions: z.array(z.string()),
    practicePlan: z.array(z.string()),
    strengths: z.array(z.string()),
  }).optional(),
  scores: z.array(evaluationScoreSchema),
  summary: z.string(),
});

export const sessionHistoryItemSchema = z.object({
  contextSnapshot: sessionSetupSnapshotSchema.optional(),
  createdAt: z.string(),
  durationSeconds: z.number().nonnegative().optional(),
  endedAt: z.string().optional(),
  evaluation: sessionReviewSchema.optional(),
  evaluationError: z.string().optional(),
  evaluationStatus: z.enum([
    "completed",
    "failed",
    "not_started",
    "pending",
    "processing",
    "too_short",
  ]),
  hasEvaluation: z.boolean(),
  id: z.string(),
  modeKey: practiceModeKeySchema,
  questionTypeKey: questionTypeKeySchema.optional(),
  status: z.enum(["artifact_saved", "created", "evaluated"]),
  styleKey: interviewStyleKeySchema,
  targetCompany: z.string(),
  targetRole: z.string(),
  transcript: z.array(voiceTranscriptTurnSchema),
});

export { deriveCoachingAttempts } from "./attempts";

export const sessionHistorySummarySchema = sessionHistoryItemSchema.pick({
  id: true, createdAt: true, endedAt: true, durationSeconds: true, evaluationStatus: true,
  hasEvaluation: true, modeKey: true, status: true, styleKey: true, targetCompany: true, targetRole: true,
});
export const sessionHistoryPageSchema = z.object({
  sessions: z.array(sessionHistorySummarySchema), nextCursor: z.string().nullable(),
});
export const reviewAccessSchema = z.object({
  kind: z.enum(["ready", "processing", "eligible", "too_short", "uncertain", "unavailable"]),
  message: z.string(), canRequest: z.boolean(),
});
export const coachingAttemptSchema = z.object({
  id: z.string(), questionId: z.string(), question: z.string(), attemptIndex: z.number().int().positive(),
  answer: z.string(), feedback: z.string(), assisted: z.boolean(),
  priority: z.string().optional(), evidence: z.array(z.object({ quote: z.string(), start: z.number().int().nonnegative(), end: z.number().int().nonnegative() })),
  promptProfile: z.enum(["current", "candidate_v2", "legacy"]), model: z.string().optional(),
  promptVersions: z.array(z.object({ key: z.string(), version: z.number().int().nonnegative() })),
  semanticQuality: z.literal("unreviewed"),
});
export const sessionDetailSchema = sessionHistoryItemSchema.extend({
  reviewAccess: reviewAccessSchema, attempts: z.array(coachingAttemptSchema),
});
export type SessionHistorySummary = z.infer<typeof sessionHistorySummarySchema>;
export type SessionHistoryPage = z.infer<typeof sessionHistoryPageSchema>;
export type ReviewAccess = z.infer<typeof reviewAccessSchema>;
export type CoachingAttempt = z.infer<typeof coachingAttemptSchema>;
export type SessionDetail = z.infer<typeof sessionDetailSchema>;

export const jobTargetSchema = z.object({
  createdAt: z.string(),
  id: z.string(),
  jobDescription: z.string(),
  label: z.string(),
  lastUsedAt: z.string().optional(),
  targetCompany: z.string(),
  targetRole: z.string(),
  updatedAt: z.string(),
});

export const catalogSchema = z.object({
  interviewStyles: z.array(z.object({
    description: z.string(),
    key: interviewStyleKeySchema,
    label: z.string(),
  }).passthrough()),
  practiceModes: z.array(z.object({
    description: z.string(),
    key: z.string(),
    name: z.string(),
    questionTypeRequired: z.boolean(),
    use: z.string(),
  }).passthrough()),
  questionTypes: z.array(z.object({
    key: questionTypeKeySchema,
    label: z.string(),
  }).passthrough()),
});

export const mobileBootstrapSchema = z.object({
  catalog: catalogSchema,
  jobTargets: z.array(jobTargetSchema),
  profile: interviewContextSchema.optional(),
  sessions: z.array(sessionHistoryItemSchema),
  user: z.object({
    email: z.string().optional(),
    id: z.string(),
    name: z.string().optional(),
  }),
});

export const mobileTokenPairSchema = z.object({
  accessExpiresAt: z.string(),
  accessToken: z.string(),
  refreshExpiresAt: z.string(),
  refreshToken: z.string(),
  user: z.object({
    email: z.string().optional(),
    id: z.string(),
    name: z.string().optional(),
  }),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    retryable: z.boolean(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
export type ChainedCoachingTurn = z.infer<typeof chainedCoachingTurnSchema>;
export type CoachingChoiceIntent = z.infer<typeof coachingChoiceIntentSchema>;
export type InterviewContext = z.infer<typeof interviewContextSchema>;
export type JobTarget = z.infer<typeof jobTargetSchema>;
export type MobileBootstrap = z.infer<typeof mobileBootstrapSchema>;
export type MobileTokenPair = z.infer<typeof mobileTokenPairSchema>;
export type PracticeModeKey = z.infer<typeof practiceModeKeySchema>;
export type QuestionTypeKey = z.infer<typeof questionTypeKeySchema>;
export type InterviewStyleKey = z.infer<typeof interviewStyleKeySchema>;
export type SessionHistoryItem = z.infer<typeof sessionHistoryItemSchema>;
export type SessionReview = z.infer<typeof sessionReviewSchema>;
export type SessionSetupSnapshot = z.infer<typeof sessionSetupSnapshotSchema>;
export type VoiceSessionArtifact = z.infer<typeof voiceSessionArtifactSchema>;
export type VoiceTranscriptTurn = z.infer<typeof voiceTranscriptTurnSchema>;
