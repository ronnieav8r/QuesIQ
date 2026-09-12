import { z } from "zod";

export const storyCategories = ["adaptability", "ambiguity", "communication", "conflict", "customer_impact", "failure", "leadership", "learning", "ownership", "problem_solving", "teamwork", "time_management"] as const;
export const materialKindSchema = z.enum(["story", "introduction"]);
const field = z.string().trim().max(12000).default("");
export const materialFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200), rawNotes: field,
  summary: field, situation: field, task: field, actions: z.array(z.string().trim().max(4000)).max(30).default([]), result: field,
  practicePrompt: z.string().trim().max(2000).default(""), categories: z.array(z.enum(storyCategories)).max(12).default([]),
  script: field, background: field, strength: field, proofPoint: field, roleInterest: field, transition: field,
  audience: z.enum(["virtual", "hr_phone", "in_person"]).default("virtual"), length: z.enum(["short", "medium", "long"]).default("medium"),
});
export const materialSaveSchema = z.object({ id: z.string().uuid(), kind: materialKindSchema, revision: z.number().int().nonnegative(), reviewed: z.boolean(), aiAssisted: z.boolean().default(false), fields: materialFieldsSchema });
export const materialDeleteSchema = materialSaveSchema.pick({ id: true, kind: true, revision: true });
export const materialDraftSchema = materialSaveSchema.pick({ id: true, kind: true, revision: true, fields: true }).extend({ targetId: z.string().uuid().optional() });
export const preparationSelectionsSchema = z.object({ storyId: z.string().uuid().optional(), introductionId: z.string().uuid().optional(), useSavedStories: z.boolean().default(true) });
export type MaterialFields = z.infer<typeof materialFieldsSchema>;
export type LabMaterial = MaterialFields & { id: string; kind: z.infer<typeof materialKindSchema>; revision: number; reviewedAt: string | null; aiAssisted: boolean; updatedAt: string };
