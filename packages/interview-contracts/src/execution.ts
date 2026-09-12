import { z } from "zod";

const modeKeySchema = z.enum(["first_impression", "coaching", "rapid_fire", "mock_interview"]);
const boundedName = z.string().trim().min(1).max(200);
const positiveInt = z.number().int().min(1);

export const interviewRuntimeSettingsSchema = z.object({
  modeKey: modeKeySchema,
  enabled: z.boolean(),
  engine: z.enum(["turn_based", "realtime"]),
  feedbackDepth: z.enum(["brief", "coaching", "review_only"]),
  maxAnswerSeconds: positiveInt,
  maxDurationSeconds: positiveInt,
  maxTurns: positiveInt,
  textModel: boundedName,
  transcriptionModel: boundedName,
  ttsModel: boundedName,
  ttsVoice: boundedName,
  realtimeModel: boundedName.optional(),
}).strict();

const overrideSchema = z.object({ field: boundedName, reason: boundedName }).strict();
// Version zero identifies a repository fallback; database prompt versions start at one.
const promptVersionSchema = z.object({ key: boundedName, version: z.number().int().min(0) }).strict();

export const interviewExecutionConfigSchema = z.object({
  schemaVersion: z.literal(1),
  surface: z.enum(["native", "inspector"]),
  revision: z.string().regex(/^[0-9a-f]{64}$/),
  configured: interviewRuntimeSettingsSchema,
  effective: interviewRuntimeSettingsSchema,
  overrides: z.array(overrideSchema).max(32),
  promptVersions: z.array(promptVersionSchema).max(32),
}).strict().superRefine((value, ctx) => {
  if (value.configured.modeKey !== value.effective.modeKey) {
    ctx.addIssue({ code: "custom", path: ["effective", "modeKey"], message: "Configured and effective modes must match." });
  }
  if (value.surface === "inspector" && (value.effective.modeKey === "mock_interview" || value.effective.engine !== "turn_based")) {
    ctx.addIssue({ code: "custom", path: ["surface"], message: "Use the Realtime inspector for Mock Interview." });
  }
  if (value.effective.engine === "realtime" && !value.effective.realtimeModel) {
    ctx.addIssue({ code: "custom", path: ["effective", "realtimeModel"], message: "Realtime execution requires a realtime model." });
  }
  if (!value.configured.enabled && value.effective.enabled) {
    ctx.addIssue({ code: "custom", path: ["effective", "enabled"], message: "A disabled configuration cannot be enabled by an override." });
  }
});

const questionSchema = z.object({ id: boundedName, text: z.string().trim().min(1).max(2000) }).strict();
export const coachingExerciseStateSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  phase: z.enum(["ready", "awaiting_answer", "awaiting_choice", "awaiting_clarification", "completed"]),
  primaryQuestionIndex: z.number().int().min(0).max(10),
  primaryQuestionLimit: z.number().int().min(1).max(10),
  attemptIndex: z.number().int().nonnegative(),
  question: questionSchema.nullable(),
}).strict().superRefine((value, ctx) => {
  if (value.primaryQuestionIndex > value.primaryQuestionLimit) ctx.addIssue({ code: "custom", path: ["primaryQuestionIndex"], message: "Question index cannot exceed limit." });
  if (value.phase === "ready" && (value.question !== null || value.primaryQuestionIndex !== 0 || value.attemptIndex !== 0)) ctx.addIssue({ code: "custom", path: ["phase"], message: "Ready state has no question and zero indices." });
  if (["awaiting_answer", "awaiting_choice", "awaiting_clarification"].includes(value.phase) && (!value.question || value.primaryQuestionIndex < 1 || value.attemptIndex < 1)) ctx.addIssue({ code: "custom", path: ["phase"], message: "Active state requires a question and positive indices." });
});

export const coachingExerciseCommandSchema = z.object({
  operationId: boundedName,
  expectedRevision: z.number().int().nonnegative(),
  action: z.enum(["start", "answer", "try_again", "more_feedback", "ask_que", "clarify", "move_on", "end"]),
  text: z.string().max(12000).optional(),
}).strict().superRefine((value, ctx) => {
  if (["answer", "clarify"].includes(value.action) && (!value.text || value.text.trim().length === 0)) ctx.addIssue({ code: "custom", path: ["text"], message: "Answer and clarification text must be nonblank." });
  if (!["answer", "clarify"].includes(value.action) && value.text !== undefined) ctx.addIssue({ code: "custom", path: ["text"], message: "This action does not accept text." });
});

export type InterviewRuntimeSettings = z.infer<typeof interviewRuntimeSettingsSchema>;
export type InterviewExecutionConfig = z.infer<typeof interviewExecutionConfigSchema>;
export type CoachingExerciseState = z.infer<typeof coachingExerciseStateSchema>;
export type CoachingExerciseCommand = z.infer<typeof coachingExerciseCommandSchema>;
export type CoachingExerciseAction = CoachingExerciseCommand["action"];
