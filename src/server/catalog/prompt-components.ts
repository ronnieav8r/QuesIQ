import { eq } from "drizzle-orm";

import type { PromptComponentRecord } from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import {
  interviewStyles,
  practiceModes,
  questionTypes,
} from "@/server/db/schema";

type PromptComponentInput = {
  key: string;
  promptInstructions: string;
  type: PromptComponentRecord["type"];
};

export async function listPromptComponents(): Promise<PromptComponentRecord[]> {
  const [modeRows, questionRows, styleRows] = await Promise.all([
    getDb()
      .select({
        description: practiceModes.description,
        displayName: practiceModes.name,
        key: practiceModes.key,
        promptInstructions: practiceModes.promptInstructions,
      })
      .from(practiceModes),
    getDb()
      .select({
        displayName: questionTypes.label,
        key: questionTypes.key,
        promptInstructions: questionTypes.promptInstructions,
      })
      .from(questionTypes),
    getDb()
      .select({
        description: interviewStyles.description,
        displayName: interviewStyles.label,
        key: interviewStyles.key,
        promptInstructions: interviewStyles.promptInstructions,
      })
      .from(interviewStyles),
  ]);

  return [
    ...modeRows.map((row) => ({ ...row, type: "mode" as const })),
    ...questionRows.map((row) => ({ ...row, type: "question_type" as const })),
    ...styleRows.map((row) => ({ ...row, type: "style" as const })),
  ];
}

export async function updatePromptComponent(
  input: PromptComponentInput,
): Promise<PromptComponentRecord | undefined> {
  const now = new Date();

  if (input.type === "mode") {
    const [row] = await getDb()
      .update(practiceModes)
      .set({ promptInstructions: input.promptInstructions.trim(), updatedAt: now })
      .where(eq(practiceModes.key, input.key))
      .returning({
        description: practiceModes.description,
        displayName: practiceModes.name,
        key: practiceModes.key,
        promptInstructions: practiceModes.promptInstructions,
      });

    return row ? { ...row, type: "mode" } : undefined;
  }

  if (input.type === "question_type") {
    const [row] = await getDb()
      .update(questionTypes)
      .set({ promptInstructions: input.promptInstructions.trim(), updatedAt: now })
      .where(eq(questionTypes.key, input.key))
      .returning({
        displayName: questionTypes.label,
        key: questionTypes.key,
        promptInstructions: questionTypes.promptInstructions,
      });

    return row ? { ...row, type: "question_type" } : undefined;
  }

  const [row] = await getDb()
    .update(interviewStyles)
    .set({ promptInstructions: input.promptInstructions.trim(), updatedAt: now })
    .where(eq(interviewStyles.key, input.key))
    .returning({
      description: interviewStyles.description,
      displayName: interviewStyles.label,
      key: interviewStyles.key,
      promptInstructions: interviewStyles.promptInstructions,
    });

  return row ? { ...row, type: "style" } : undefined;
}
