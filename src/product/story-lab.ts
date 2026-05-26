import type {
  StoryBuilderTurn,
  StoryCategory,
  StoryOutline,
} from "@/product/interview-types";

export const storyCategories: StoryCategory[] = [
  "adaptability",
  "ambiguity",
  "communication",
  "conflict",
  "customer_impact",
  "failure",
  "leadership",
  "learning",
  "ownership",
  "problem_solving",
  "teamwork",
  "time_management",
];

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function cleanStringArray(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isString).map((item) => item.trim()).filter(Boolean).slice(0, maxItems);
}

export function parseStoryBuilderTurns(value: unknown): StoryBuilderTurn[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const turns = value
    .map((turn) => {
      if (!turn || typeof turn !== "object") {
        return undefined;
      }

      const candidate = turn as Partial<StoryBuilderTurn>;

      if (
        !isString(candidate.id) ||
        !isString(candidate.text) ||
        (candidate.role !== "assistant" && candidate.role !== "user")
      ) {
        return undefined;
      }

      return {
        id: candidate.id,
        role: candidate.role,
        text: candidate.text.trim(),
      };
    })
    .filter((turn): turn is StoryBuilderTurn => Boolean(turn?.text));

  return turns.length > 0 ? turns : undefined;
}

export function parseStoryOutline(value: unknown): StoryOutline | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<StoryOutline>;
  const categories = Array.isArray(candidate.categories)
    ? candidate.categories.filter((category): category is StoryCategory =>
        storyCategories.includes(category as StoryCategory),
      )
    : [];
  const alternateSpins = Array.isArray(candidate.alternateSpins)
    ? candidate.alternateSpins
        .map((spin) => {
          if (!spin || typeof spin !== "object") {
            return undefined;
          }

          const spinCandidate = spin as Partial<StoryOutline["alternateSpins"][number]>;

          if (
            !isString(spinCandidate.angle) ||
            !isString(spinCandidate.question) ||
            !isString(spinCandidate.whyItWorks)
          ) {
            return undefined;
          }

          return {
            angle: spinCandidate.angle.trim(),
            question: spinCandidate.question.trim(),
            whyItWorks: spinCandidate.whyItWorks.trim(),
          };
        })
        .filter((spin): spin is StoryOutline["alternateSpins"][number] => Boolean(spin))
        .slice(0, 5)
    : [];

  if (
    !isString(candidate.title) ||
    !isString(candidate.summary) ||
    !isString(candidate.situation) ||
    !isString(candidate.task) ||
    !isString(candidate.result) ||
    !isString(candidate.practicePrompt)
  ) {
    return undefined;
  }

  return {
    actions: cleanStringArray(candidate.actions, 6),
    alternateSpins,
    categories,
    coachNotes: cleanStringArray(candidate.coachNotes, 6),
    practicePrompt: candidate.practicePrompt.trim(),
    result: candidate.result.trim(),
    situation: candidate.situation.trim(),
    summary: candidate.summary.trim(),
    task: candidate.task.trim(),
    title: candidate.title.trim(),
  };
}

export function parseStoryUpdate(value: unknown):
  | {
      outline: StoryOutline;
      rawNotes: string;
    }
  | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as { outline?: unknown; rawNotes?: unknown };
  const outline = parseStoryOutline(candidate.outline);

  if (!outline || !isString(candidate.rawNotes)) {
    return undefined;
  }

  return {
    outline,
    rawNotes: candidate.rawNotes.trim(),
  };
}

export function storyCategoryLabel(category: StoryCategory) {
  return category
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
