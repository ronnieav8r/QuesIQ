import { z } from "zod";

export const progressFilterSchema = z.object({ target: z.union([z.literal("active"), z.literal("all"), z.literal("general"), z.string().uuid()]).default("active"), range: z.enum(["30", "90", "all"]).default("30") });
export const evidenceLinkSchema = z.object({ sessionId: z.string().uuid(), attemptId: z.string().uuid(), turnIndex: z.number().int().nonnegative() });
export const recommendationReasonSchema = z.enum(["priority", "review_retry", "saved_question", "coverage", "cold_start"]);
export const recommendationSchema = z.object({ id: z.string().length(64), action: z.string(), mode: z.enum(["coaching", "first_impression", "rapid_fire"]), reason: z.string(), reasonCode: recommendationReasonSchema, targetId: z.string().uuid().nullable(), targetLabel: z.string(), questionId: z.string().uuid().optional(), questionText: z.string().optional(), category: z.string().optional(), evidence: evidenceLinkSchema.optional() });
export const recommendationSelectionSchema = z.object({ id: z.string().length(64), targetId: z.string().uuid().nullable() });
export const recommendationDismissSchema = recommendationSelectionSchema;
export type EvidenceLink = z.infer<typeof evidenceLinkSchema>;
export type PracticeRecommendation = z.infer<typeof recommendationSchema>;
export type RecommendationResponse = { suggestions: PracticeRecommendation[]; targetId: string | null };
export type ProgressAttempt = { id: string; sessionId: string; turnIndex: number; date: string; question: string; answer: string; category: string; classification: "initial" | "guided_retry" | "repeated"; review?: { finding: string; improvement: string; model: string; rubric: string }; evidence: EvidenceLink };
export type ProgressResponse = {
  targetId: string | null; allTargets: boolean; range: "30" | "90" | "all";
  counts: { sessions: number; independentSessions: number; initialAnswers: number; subsequentAttempts: number; repeatedAnswers: number; unclassifiedSessions: number; excludedLegacySessions: number };
  categories: Array<{ key: string; label: string; answers: number; sessions: number; recent: ProgressAttempt[] }>;
  attempts: ProgressAttempt[];
  quality: Array<{ sessionId: string; date: string; mode: string; model: string; rubric: string; targetId: string | null; assistance: string; comparable: boolean; explanation: string; scores: Array<{ key: string; label: string; score: number }>; group: string }>;
  trends: Array<{ group: string; label: string; sessionIds: string[]; results: Array<{ sessionId: string; date: string; scores: Array<{ key: string; label: string; score: number }> }> }>;
  notes: string[];
};
const count = z.number().int().nonnegative();
export const progressAttemptSchema = z.object({ id: z.string().uuid(), sessionId: z.string().uuid(), turnIndex: count, date: z.string(), question: z.string(), answer: z.string(), category: z.string(), classification: z.enum(["initial", "guided_retry", "repeated"]), review: z.object({ finding: z.string(), improvement: z.string(), model: z.string(), rubric: z.string() }).optional(), evidence: evidenceLinkSchema });
const qualityScores = z.array(z.object({ key: z.string(), label: z.string(), score: z.number().finite() }));
export const recommendationResponseSchema: z.ZodType<RecommendationResponse> = z.object({ suggestions: z.array(recommendationSchema).max(3), targetId: z.string().uuid().nullable() });
export const progressResponseSchema: z.ZodType<ProgressResponse> = z.object({
  targetId: z.string().uuid().nullable(), allTargets: z.boolean(), range: z.enum(["30", "90", "all"]),
  counts: z.object({ sessions: count, independentSessions: count, initialAnswers: count, subsequentAttempts: count, repeatedAnswers: count, unclassifiedSessions: count, excludedLegacySessions: count }),
  attempts: z.array(progressAttemptSchema),
  categories: z.array(z.object({ key: z.string(), label: z.string(), answers: count, sessions: count, recent: z.array(progressAttemptSchema) })),
  quality: z.array(z.object({ sessionId: z.string().uuid(), date: z.string(), mode: z.string(), model: z.string(), rubric: z.string(), targetId: z.string().uuid().nullable(), assistance: z.string(), comparable: z.boolean(), explanation: z.string(), scores: qualityScores, group: z.string() })),
  trends: z.array(z.object({ group: z.string(), label: z.string(), sessionIds: z.array(z.string().uuid()).min(3), results: z.array(z.object({ sessionId: z.string().uuid(), date: z.string(), scores: qualityScores })).min(3) })), notes: z.array(z.string()),
});
