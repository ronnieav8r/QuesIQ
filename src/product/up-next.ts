import type {
  InterviewContext,
  ProgressionSummaryRecord,
  SessionDebriefRecord,
  SessionHistoryItem,
  StoryRecord,
} from "@/product/interview-types";
import { getOverallScore } from "@/product/scoring";

export type UpNextRecommendation =
  | {
      actionLabel: string;
      body: string;
      kind: "pending_review";
      session: SessionHistoryItem;
      title: string;
    }
  | {
      actionLabel: string;
      body: string;
      kind: "missing_context" | "missing_resume" | "story_build" | "default_practice";
      title: string;
    }
  | {
      actionLabel: string;
      body: string;
      kind: "debrief_recent";
      session: SessionHistoryItem;
      title: string;
    }
  | {
      actionLabel: string;
      body: string;
      kind: "weak_score";
      title: string;
      weakestScore: {
        average: number;
        label: string;
      };
    }
  | {
      actionLabel: string;
      body: string;
      kind: "quest";
      title: string;
    };

type ScoreAverage = {
  average?: number;
  key: string;
  label: string;
};

type UpNextInput = {
  completedReviews: SessionHistoryItem[];
  contextReady: boolean;
  debriefs: SessionDebriefRecord[];
  interviewContext: InterviewContext;
  needsReview: SessionHistoryItem[];
  progression?: ProgressionSummaryRecord;
  scoreAverages: ScoreAverage[];
  stories: StoryRecord[];
};

function getWeakestScore({
  progression,
  scoreAverages,
}: Pick<UpNextInput, "progression" | "scoreAverages">) {
  if (progression?.weakestScoreLabel && progression.weakestScoreAverage !== undefined) {
    return {
      average: progression.weakestScoreAverage,
      label: progression.weakestScoreLabel,
    };
  }

  return scoreAverages
    .filter((score) => score.average !== undefined && score.key !== "overall")
    .map((score) => ({
      average: score.average ?? 0,
      label: score.label,
    }))
    .sort((a, b) => a.average - b.average)[0];
}

function getQuestNudge(progression?: ProgressionSummaryRecord) {
  return progression?.quests
    ?.filter((quest) => quest.status !== "completed" && quest.checkThreshold > 0)
    .map((quest) => ({
      ...quest,
      ratio: quest.progress / quest.checkThreshold,
    }))
    .filter((quest) => quest.ratio >= 0.75)
    .sort((a, b) => b.ratio - a.ratio)[0];
}

export function getUpNextRecommendation({
  completedReviews,
  contextReady,
  debriefs,
  interviewContext,
  needsReview,
  progression,
  scoreAverages,
  stories,
}: UpNextInput): UpNextRecommendation {
  const pendingReview = needsReview[0];

  if (pendingReview) {
    return {
      actionLabel: "Open Review",
      body: "A saved transcript is waiting for a review retry before it can count toward your progress.",
      kind: "pending_review",
      session: pendingReview,
      title: "Finish your pending review.",
    };
  }

  if (!contextReady) {
    return {
      actionLabel: "Add Context",
      body: "Give Que your name and target role so practice can feel specific instead of generic.",
      kind: "missing_context",
      title: "Add your interview context.",
    };
  }

  if (!interviewContext.resumeText) {
    return {
      actionLabel: "Add Resume",
      body: "A parsed resume helps Que ask better role-relevant questions and helps reviews judge relevance.",
      kind: "missing_resume",
      title: "Add your resume for sharper practice.",
    };
  }

  const latestCompleted = completedReviews[0];
  const hasDebriefForLatest =
    latestCompleted && debriefs.some((debrief) => debrief.sessionId === latestCompleted.id);

  if (latestCompleted && !hasDebriefForLatest) {
    const overall = latestCompleted.evaluation
      ? getOverallScore(latestCompleted.evaluation.scores)
      : undefined;

    return {
      actionLabel: "Debrief",
      body: overall
        ? `Your last reviewed session averaged ${overall.toFixed(1)}. Debrief it while the details are fresh.`
        : "Debrief your latest reviewed session while the details are fresh.",
      kind: "debrief_recent",
      session: latestCompleted,
      title: "Debrief your last practice.",
    };
  }

  const weakestScore = getWeakestScore({ progression, scoreAverages });

  if (weakestScore && weakestScore.average < 4.2) {
    return {
      actionLabel: "Start Practice",
      body: `Your ${weakestScore.label.toLowerCase()} average is ${weakestScore.average.toFixed(1)}. Use the next session to strengthen that dimension.`,
      kind: "weak_score",
      title: `Practice ${weakestScore.label.toLowerCase()} next.`,
      weakestScore,
    };
  }

  if (stories.length === 0 && completedReviews.length > 0) {
    return {
      actionLabel: "Open Story Lab",
      body: "Turn one real work example into a reusable interview story before the next behavioral question.",
      kind: "story_build",
      title: "Build a reusable interview story.",
    };
  }

  const quest = getQuestNudge(progression);

  if (quest) {
    return {
      actionLabel: "Start Practice",
      body: `${quest.title} is close: ${Math.min(quest.progress, quest.checkThreshold)}/${quest.checkThreshold}.`,
      kind: "quest",
      title: "Finish a near-complete quest.",
    };
  }

  return {
    actionLabel: "Start Practice",
    body: `Que can use your ${interviewContext.targetRole} context while you keep building consistency.`,
    kind: "default_practice",
    title: `Practice your ${interviewContext.targetRole} next.`,
  };
}
