import type {
  InterviewContext,
  IntroductionRecord,
  JobTargetRecord,
  ProgressionSummaryRecord,
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
      kind:
        | "intro_build"
        | "missing_context"
        | "missing_resume"
        | "story_build"
        | "target_notes"
        | "target_select"
        | "default_practice";
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
  interviewContext: InterviewContext;
  introductions: IntroductionRecord[];
  jobTargets: JobTargetRecord[];
  needsReview: SessionHistoryItem[];
  progression?: ProgressionSummaryRecord;
  scoreAverages: ScoreAverage[];
  selectedJobTarget?: JobTargetRecord;
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
  interviewContext,
  introductions,
  jobTargets,
  needsReview,
  progression,
  scoreAverages,
  selectedJobTarget,
  stories,
}: UpNextInput): UpNextRecommendation {
  const pendingReview = needsReview[0];
  const activeTarget =
    selectedJobTarget ??
    jobTargets.find((target) => target.id === interviewContext.jobTargetId);

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
      actionLabel: "Open Me",
      body: "Add your name and at least one job target so Que knows who you are and what role to practice for.",
      kind: "missing_context",
      title: "Set up Me and job targets.",
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

  if (jobTargets.length === 0 && interviewContext.targetRole.trim()) {
    return {
      actionLabel: "Save Target",
      body: "Move your current role and company into a saved job target so future practice can stay tied to a specific opportunity.",
      kind: "missing_context",
      title: "Create your first job target.",
    };
  }

  if (jobTargets.length > 0 && !activeTarget) {
    return {
      actionLabel: "Choose Target",
      body: "Pick the saved opportunity Que should treat as the active context before the next practice session.",
      kind: "target_select",
      title: "Choose your active job target.",
    };
  }

  if (activeTarget && !activeTarget.jobDescription.trim()) {
    return {
      actionLabel: "Add Notes",
      body: `Add posting details or interview notes for ${activeTarget.label} so Que can route questions and reviews toward that opportunity.`,
      kind: "target_notes",
      title: "Sharpen the active target.",
    };
  }

  if (introductions.length === 0) {
    return {
      actionLabel: "Open Story Lab",
      body: "Build a concise introduction before the next first-impression or screening practice.",
      kind: "intro_build",
      title: "Prepare your interview introduction.",
    };
  }

  const latestCompleted = completedReviews[0];
  const activeTargetReview = activeTarget
    ? completedReviews.find(
        (session) =>
          session.targetRole === activeTarget.targetRole &&
          session.targetCompany === activeTarget.targetCompany,
      )
    : undefined;

  if (activeTarget && completedReviews.length > 0 && !activeTargetReview) {
    return {
      actionLabel: "Start Practice",
      body: `You have reviews saved, but none for ${activeTarget.label} yet. Start one target-specific session so Que can build signal for this opportunity.`,
      kind: "default_practice",
      title: `Practice for ${activeTarget.targetRole} next.`,
    };
  }

  if (latestCompleted) {
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
    body:
      activeTarget
        ? `Practice against ${activeTarget.label} while Que keeps the role context in view.`
        : `Que can use your ${interviewContext.targetRole} context while you keep building consistency.`,
    kind: "default_practice",
    title:
      activeTarget
        ? `Practice for ${activeTarget.targetRole} next.`
        : `Practice your ${interviewContext.targetRole} next.`,
  };
}
