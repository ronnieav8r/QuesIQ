import { asc, eq } from "drizzle-orm";

import type {
  InterviewCatalog,
  InterviewStyleKey,
  PracticeModeKey,
  QuestionTypeKey,
} from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import {
  interviewStyles,
  practiceModes,
  questionTypes,
} from "@/server/db/schema";

export async function listInterviewCatalog(): Promise<InterviewCatalog> {
  const [modeRows, questionRows, styleRows] = await Promise.all([
    getDb()
      .select({
        description: practiceModes.description,
        displayOrder: practiceModes.displayOrder,
        key: practiceModes.key,
        name: practiceModes.name,
        promptInstructions: practiceModes.promptInstructions,
        questionTypeRequired: practiceModes.questionTypeRequired,
        use: practiceModes.use,
      })
      .from(practiceModes)
      .where(eq(practiceModes.enabled, true))
      .orderBy(asc(practiceModes.displayOrder)),
    getDb()
      .select({
        displayOrder: questionTypes.displayOrder,
        key: questionTypes.key,
        label: questionTypes.label,
        promptInstructions: questionTypes.promptInstructions,
      })
      .from(questionTypes)
      .where(eq(questionTypes.enabled, true))
      .orderBy(asc(questionTypes.displayOrder)),
    getDb()
      .select({
        description: interviewStyles.description,
        displayOrder: interviewStyles.displayOrder,
        key: interviewStyles.key,
        label: interviewStyles.label,
        promptInstructions: interviewStyles.promptInstructions,
      })
      .from(interviewStyles)
      .where(eq(interviewStyles.enabled, true))
      .orderBy(asc(interviewStyles.displayOrder)),
  ]);

  return {
    interviewStyles: styleRows.map((style) => ({
      ...style,
      key: style.key as InterviewStyleKey,
    })),
    practiceModes: modeRows.map((mode) => ({
      ...mode,
      key: mode.key as PracticeModeKey,
    })),
    questionTypes: questionRows.map((questionType) => ({
      ...questionType,
      key: questionType.key as QuestionTypeKey,
    })),
  };
}
