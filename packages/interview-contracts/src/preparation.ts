import { z } from "zod";

export const preparationActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("name"), preferredName: z.string().trim().max(100) }),
  z.object({ action: z.literal("target_save"), id: z.string().uuid().optional(), targetRole: z.string().trim().min(1).max(200), targetCompany: z.string().trim().max(200), jobDescription: z.string().trim().max(12000) }),
  z.object({ action: z.literal("target_active"), id: z.string().uuid().nullable() }),
  z.object({ action: z.literal("target_delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("resume_confirm"), text: z.string().trim().min(1).max(12000), name: z.string().trim().min(1).max(255), mimeType: z.string().max(150).default("text/plain"), size: z.number().int().min(0).max(2 * 1024 * 1024).default(0) }),
  z.object({ action: z.literal("resume_remove") }),
  z.object({ action: z.literal("resume_summary_accept"), draftId: z.string().uuid() }),
]);
export const preparationMutationSchema = z.object({ revision: z.number().int().nonnegative(), change: preparationActionSchema });
export type PreparationMutation = z.infer<typeof preparationMutationSchema>;
