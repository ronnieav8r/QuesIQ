import { z } from "zod";
export const questionSelectionSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(10), mode: z.enum(["coaching", "rapid_fire"]) }).refine(value => value.mode !== "coaching" || value.ids.length === 1, "Coaching uses one exact question.").refine(value => new Set(value.ids).size === value.ids.length, "Question selections must be unique.");
export const savedQuestionActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), questionId: z.string().uuid() }),
  z.object({ action: z.literal("custom"), text: z.string().trim().min(5).max(2000) }),
  z.object({ action: z.literal("from_session"), sessionId: z.string().uuid(), questionIndex: z.number().int().nonnegative().max(199) }),
  z.object({ action: z.literal("unsave"), questionId: z.string().uuid() }),
  z.object({ action: z.literal("queue"), targetId: z.string().uuid().nullable(), revision: z.number().int().nonnegative(), ids: z.array(z.string().uuid()).max(10) }),
]);
export type SavedQuestion = { id: string; text: string; available: boolean; compatibleModes: string[]; source: string; category?: string };
export type QuestionPreferences = { saved: SavedQuestion[]; bank: SavedQuestion[]; queues: Array<{ targetId: string | null; revision: number; ids: string[] }> };
