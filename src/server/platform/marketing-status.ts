import { eq } from "drizzle-orm";

import type { PlatformProductKey } from "@/features/platform/products";
import { getDb } from "@/server/db/client";
import {
  dpeUserProgression,
  platformProductUsage,
  studyUserProgression,
  userProgression,
} from "@/server/db/schema";

type StatusBar = {
  label: string;
  tone: string;
  value: number;
};

export type MarketingAppStatus = {
  bars: StatusBar[];
  href: string;
  key: PlatformProductKey;
  lastUsedLabel: string;
  levelLabel: string;
  logoAlt: string;
  logoSrc: string;
  metricLabel: string;
  nextAction: string;
  score: number;
  statLabel: string;
  statValue: string;
  subtitle: string;
  title: string;
};

type UsageSummary = {
  lastUsedAt: Date;
  productKey: string;
  sessionCount: number;
  totalActiveSeconds: number;
};

const loggedOutStatuses: MarketingAppStatus[] = [
  {
    bars: [
      { label: "Clarity", tone: "violet", value: 86 },
      { label: "Confidence", tone: "orange", value: 74 },
      { label: "Relevance", tone: "blue", value: 82 },
    ],
    href: "/login?next=/interview",
    key: "interview",
    lastUsedLabel: "Try a guided session",
    levelLabel: "Interview readiness",
    logoAlt: "QuesIQ Interview",
    logoSrc: "/brand/quesiq-interview-logo.png",
    metricLabel: "Preview",
    nextAction: "Start with a target role and a short coaching round.",
    score: 84,
    statLabel: "Mode",
    statValue: "Voice practice",
    subtitle: "Practice answers, get coaching, and review session feedback.",
    title: "Interview",
  },
  {
    bars: [
      { label: "Recall", tone: "green", value: 76 },
      { label: "Retention", tone: "blue", value: 88 },
      { label: "Coverage", tone: "violet", value: 70 },
    ],
    href: "/login?next=/study",
    key: "study",
    lastUsedLabel: "Build a deck",
    levelLabel: "Study momentum",
    logoAlt: "QuesIQ Study",
    logoSrc: "/brand/quesiq-study-logo.png",
    metricLabel: "Preview",
    nextAction: "Open Study and review a flashcard deck.",
    score: 78,
    statLabel: "Mode",
    statValue: "Flashcards",
    subtitle: "Review cards, speak answers, and build repeatable recall.",
    title: "Study",
  },
  {
    bars: [
      { label: "Knowledge", tone: "amber", value: 72 },
      { label: "Judgment", tone: "orange", value: 80 },
      { label: "Readiness", tone: "green", value: 68 },
    ],
    href: "/login?next=/dpe",
    key: "dpe",
    lastUsedLabel: "Set checkride target",
    levelLabel: "Oral prep readiness",
    logoAlt: "QuesIQ DPE",
    logoSrc: "/brand/quesiq-dpe-logo.png",
    metricLabel: "Preview",
    nextAction: "Choose your certificate target and start a scenario.",
    score: 73,
    statLabel: "Track",
    statValue: "Private ASEL",
    subtitle: "Work through checkride-style questions and scenario prompts.",
    title: "DPE",
  },
];

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function progressPercent(current: number, next: number) {
  return next > 0 ? clampPercent((current / next) * 100) : 0;
}

function formatActiveTime(seconds: number) {
  const minutes = Math.round(seconds / 60);

  if (minutes < 1) {
    return "New";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  return `${Math.round(minutes / 60)} hr`;
}

function formatLastUsed(value?: Date) {
  if (!value) {
    return "Not started yet";
  }

  const deltaMs = Date.now() - value.getTime();
  const days = Math.max(0, Math.floor(deltaMs / 86_400_000));

  if (days === 0) {
    return "Used today";
  }

  if (days === 1) {
    return "Used yesterday";
  }

  return `Used ${days} days ago`;
}

function usageFor(productKey: PlatformProductKey, rows: UsageSummary[]) {
  return rows.find((row) => row.productKey === productKey);
}

export async function getMarketingAppStatuses(userId?: string | null) {
  if (!userId || !process.env.DATABASE_URL) {
    return loggedOutStatuses;
  }

  try {
    const db = getDb();
    const [usageRows, interviewRows, studyRows, dpeRows] = await Promise.all([
      db
        .select({
          lastUsedAt: platformProductUsage.lastUsedAt,
          productKey: platformProductUsage.productKey,
          sessionCount: platformProductUsage.sessionCount,
          totalActiveSeconds: platformProductUsage.totalActiveSeconds,
        })
        .from(platformProductUsage)
        .where(eq(platformProductUsage.userId, userId)),
      db
        .select({
          completedReviews: userProgression.completedReviews,
          currentLevelXp: userProgression.currentLevelXp,
          latestNextAction: userProgression.latestNextAction,
          level: userProgression.level,
          nextLevelXp: userProgression.nextLevelXp,
          streakDays: userProgression.streakDays,
          weakestScoreAverageTenths: userProgression.weakestScoreAverageTenths,
        })
        .from(userProgression)
        .where(eq(userProgression.userId, userId))
        .limit(1),
      db
        .select({
          accuracyBps: studyUserProgression.accuracyBps,
          currentLevelXp: studyUserProgression.currentLevelXp,
          level: studyUserProgression.level,
          nextLevelXp: studyUserProgression.nextLevelXp,
          streakDays: studyUserProgression.streakDays,
          totalAttempts: studyUserProgression.totalAttempts,
        })
        .from(studyUserProgression)
        .where(eq(studyUserProgression.userId, userId))
        .limit(1),
      db
        .select({
          answeredPrompts: dpeUserProgression.answeredPrompts,
          completedSessions: dpeUserProgression.completedSessions,
          currentLevelXp: dpeUserProgression.currentLevelXp,
          level: dpeUserProgression.level,
          nextLevelXp: dpeUserProgression.nextLevelXp,
          readinessScoreBps: dpeUserProgression.readinessScoreBps,
          reviewedSessions: dpeUserProgression.reviewedSessions,
        })
        .from(dpeUserProgression)
        .where(eq(dpeUserProgression.userId, userId))
        .limit(1),
    ]);

    const interview = interviewRows[0];
    const study = studyRows[0];
    const dpe = dpeRows[0];
    const interviewUsage = usageFor("interview", usageRows);
    const studyUsage = usageFor("study", usageRows);
    const dpeUsage = usageFor("dpe", usageRows);
    const interviewScore = interview?.weakestScoreAverageTenths
      ? clampPercent((interview.weakestScoreAverageTenths / 50) * 100)
      : progressPercent(interview?.currentLevelXp ?? 0, interview?.nextLevelXp ?? 300);

    return [
      {
        ...loggedOutStatuses[0],
        bars: [
          {
            label: "Level progress",
            tone: "violet",
            value: progressPercent(interview?.currentLevelXp ?? 0, interview?.nextLevelXp ?? 300),
          },
          {
            label: "Reviews",
            tone: "orange",
            value: clampPercent(((interview?.completedReviews ?? 0) / 10) * 100),
          },
          {
            label: "Streak",
            tone: "blue",
            value: clampPercent(((interview?.streakDays ?? 0) / 7) * 100),
          },
        ],
        href: "/interview",
        lastUsedLabel: formatLastUsed(interviewUsage?.lastUsedAt),
        levelLabel: `Level ${interview?.level ?? 1}`,
        metricLabel: interview?.weakestScoreAverageTenths ? "Readiness" : "Progress",
        nextAction:
          interview?.latestNextAction || "Open Interview and complete the next practice round.",
        score: interviewScore,
        statLabel: "Active time",
        statValue: formatActiveTime(interviewUsage?.totalActiveSeconds ?? 0),
      },
      {
        ...loggedOutStatuses[1],
        bars: [
          {
            label: "Accuracy",
            tone: "green",
            value: clampPercent((study?.accuracyBps ?? 0) / 100),
          },
          {
            label: "Level progress",
            tone: "blue",
            value: progressPercent(study?.currentLevelXp ?? 0, study?.nextLevelXp ?? 200),
          },
          {
            label: "Streak",
            tone: "violet",
            value: clampPercent(((study?.streakDays ?? 0) / 7) * 100),
          },
        ],
        href: "/study",
        lastUsedLabel: formatLastUsed(studyUsage?.lastUsedAt),
        levelLabel: `Level ${study?.level ?? 1}`,
        metricLabel: "Accuracy",
        nextAction: "Open Study and clear the next due card set.",
        score: clampPercent((study?.accuracyBps ?? 0) / 100),
        statLabel: "Cards tried",
        statValue: String(study?.totalAttempts ?? 0),
      },
      {
        ...loggedOutStatuses[2],
        bars: [
          {
            label: "Readiness",
            tone: "amber",
            value: clampPercent((dpe?.readinessScoreBps ?? 0) / 100),
          },
          {
            label: "Sessions",
            tone: "orange",
            value: clampPercent(((dpe?.completedSessions ?? 0) / 8) * 100),
          },
          {
            label: "Prompts",
            tone: "green",
            value: clampPercent(((dpe?.answeredPrompts ?? 0) / 40) * 100),
          },
        ],
        href: "/dpe",
        lastUsedLabel: formatLastUsed(dpeUsage?.lastUsedAt),
        levelLabel: `Level ${dpe?.level ?? 1}`,
        metricLabel: "Readiness",
        nextAction: "Open DPE and continue the next oral-prep scenario.",
        score: clampPercent((dpe?.readinessScoreBps ?? 0) / 100),
        statLabel: "Reviewed",
        statValue: String(dpe?.reviewedSessions ?? 0),
      },
    ] satisfies MarketingAppStatus[];
  } catch {
    return loggedOutStatuses.map((status) => ({
      ...status,
      href: status.href.replace("/login?next=", ""),
      lastUsedLabel: "Status unavailable",
    }));
  }
}
