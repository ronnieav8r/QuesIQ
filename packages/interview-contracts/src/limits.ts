import { z } from "zod";
export const interviewLimitReasonSchema = z.enum(["beta_disabled", "budget_configuration", "pricing_unavailable", "session_budget", "account_budget", "global_budget", "session_active", "session_expired", "operation_pending", "budget_storage", "realtime_unverified"]);
export const interviewLimitOutcomeSchema = z.object({
  reason: interviewLimitReasonSchema,
  message: z.string(),
  resetAt: z.string().datetime().optional(),
  recoveryActions: z.array(z.enum(["save", "view_history", "manual_edit", "retry_later"])),
  review: z.enum(["reserved", "deferred"]),
});
export type InterviewLimitOutcome = z.infer<typeof interviewLimitOutcomeSchema>;
export type InterviewLimitReason = z.infer<typeof interviewLimitReasonSchema>;
