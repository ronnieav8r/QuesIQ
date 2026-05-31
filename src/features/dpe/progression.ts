import type { DpeQuestion } from "./questions";

export type DpeQuestRuleType =
  | "first_oral_session"
  | "review_completed"
  | "acs_area_task_coverage"
  | "question_count"
  | "score_threshold"
  | "weak_acs_resolved"
  | "checkride_target_set";

export type DpeQuestDefinition = {
  id: string;
  title: string;
  description: string;
  ruleType: DpeQuestRuleType;
  target: number;
};

export type DpeReadinessInput = {
  answeredPrompts: number;
  completedSessions: number;
  hasCheckrideTarget: boolean;
  reviewedSessions: number;
  scoredSessionsAtOrAbove4: number;
  uniqueAreaTasksPracticed: number;
  weakFocusesResolved: number;
};

export type DpeReadinessQuestProgress = {
  current: number;
  done: boolean;
  id: string;
  target: number;
  title: string;
};

export const dpeQuestDefinitions: DpeQuestDefinition[] = [
  {
    description: "Complete your first DPE oral session.",
    id: "dpe_first_oral_session",
    ruleType: "first_oral_session",
    target: 1,
    title: "First Oral Session",
  },
  {
    description: "Finish one transcript-backed review.",
    id: "dpe_first_review_completed",
    ruleType: "review_completed",
    target: 1,
    title: "Review Completed",
  },
  {
    description: "Practice at least five ACS area/task combinations.",
    id: "dpe_acs_coverage_5",
    ruleType: "acs_area_task_coverage",
    target: 5,
    title: "ACS Coverage",
  },
  {
    description: "Answer at least twenty oral prompts across sessions.",
    id: "dpe_question_count_20",
    ruleType: "question_count",
    target: 20,
    title: "Question Volume",
  },
  {
    description: "Earn readiness score 4+ in three reviewed sessions.",
    id: "dpe_score_threshold_4x3",
    ruleType: "score_threshold",
    target: 3,
    title: "Readiness 4+",
  },
  {
    description: "Resolve at least two weak ACS focuses after re-practice.",
    id: "dpe_weak_acs_resolved_2",
    ruleType: "weak_acs_resolved",
    target: 2,
    title: "Weak ACS Resolved",
  },
  {
    description: "Set aircraft and checkride target details in Me.",
    id: "dpe_checkride_target_set",
    ruleType: "checkride_target_set",
    target: 1,
    title: "Checkride Target Set",
  },
];

export function buildDpeReadinessQuestProgress(
  input: DpeReadinessInput,
): DpeReadinessQuestProgress[] {
  return dpeQuestDefinitions.map((quest) => {
    const current = currentForQuest(quest.ruleType, input);
    return {
      current,
      done: current >= quest.target,
      id: quest.id,
      target: quest.target,
      title: quest.title,
    };
  });
}

export function buildAreaTaskCoverageCount(sessions: Array<{ answers: Array<{ question: DpeQuestion }> }>) {
  const keys = new Set<string>();
  for (const session of sessions) {
    for (const answer of session.answers) {
      keys.add(`${answer.question.acsArea}.${answer.question.acsTask}`);
    }
  }
  return keys.size;
}

function currentForQuest(ruleType: DpeQuestRuleType, input: DpeReadinessInput) {
  switch (ruleType) {
    case "first_oral_session":
      return input.completedSessions;
    case "review_completed":
      return input.reviewedSessions;
    case "acs_area_task_coverage":
      return input.uniqueAreaTasksPracticed;
    case "question_count":
      return input.answeredPrompts;
    case "score_threshold":
      return input.scoredSessionsAtOrAbove4;
    case "weak_acs_resolved":
      return input.weakFocusesResolved;
    case "checkride_target_set":
      return input.hasCheckrideTarget ? 1 : 0;
    default:
      return 0;
  }
}
