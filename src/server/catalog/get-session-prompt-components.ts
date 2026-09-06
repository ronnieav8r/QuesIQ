import { eq } from "drizzle-orm";

import type {
  SessionPromptComponents,
  SessionSetupSnapshot,
} from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import {
  interviewStyles,
  practiceModes,
  questionTypes,
} from "@/server/db/schema";

export type { SessionPromptComponents } from "@/product/interview-types";

export async function getSessionPromptComponents(
  snapshot: SessionSetupSnapshot,
): Promise<SessionPromptComponents> {
  if (snapshot.executionConfig && snapshot.executionPromptSnapshot) {
    return snapshot.executionPromptSnapshot.components;
  }
  const [modeRows, questionRows, styleRows] = await Promise.all([
    getDb()
      .select({
        description: practiceModes.description,
        key: practiceModes.key,
        name: practiceModes.name,
        promptInstructions: practiceModes.promptInstructions,
        use: practiceModes.use,
      })
      .from(practiceModes)
      .where(eq(practiceModes.key, snapshot.modeKey))
      .limit(1),
    snapshot.questionTypeKey
      ? getDb()
          .select({
            key: questionTypes.key,
            label: questionTypes.label,
            promptInstructions: questionTypes.promptInstructions,
          })
          .from(questionTypes)
          .where(eq(questionTypes.key, snapshot.questionTypeKey))
          .limit(1)
      : Promise.resolve([]),
    getDb()
      .select({
        description: interviewStyles.description,
        key: interviewStyles.key,
        label: interviewStyles.label,
        promptInstructions: interviewStyles.promptInstructions,
      })
      .from(interviewStyles)
      .where(eq(interviewStyles.key, snapshot.styleKey))
      .limit(1),
  ]);

  return {
    mode: modeRows[0] as SessionPromptComponents["mode"],
    questionType: questionRows[0] as SessionPromptComponents["questionType"],
    style: styleRows[0] as SessionPromptComponents["style"],
  };
}
