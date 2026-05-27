import { and, eq } from "drizzle-orm";

import type {
  SessionEvaluationResult,
  SessionSetupSnapshot,
  VoiceSessionArtifactDraft,
} from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import {
  coachingMemory,
  debriefs,
  evaluations,
  profiles,
  sessions,
  stories,
  introductions,
  userFeedback,
  users,
} from "@/server/db/schema";
import { recordReviewProgression } from "@/server/progression/progression";

async function findRonnieUser(fallbackUserId: string) {
  const rows = await getDb()
    .select({
      email: users.email,
      id: users.id,
      name: users.name,
    })
    .from(users)
    .limit(200);

  return (
    rows.find((user) =>
      [user.email, user.name, user.id].some((value) =>
        value?.toLowerCase().includes("ronnieav8r"),
      ),
    )?.id ?? fallbackUserId
  );
}

const demoSnapshot: SessionSetupSnapshot = {
  interviewContext: {
    jobDescription:
      "Lead cross-functional operations, communicate decisions clearly, and improve customer outcomes.",
    preferredName: "Ronnie",
    resumeName: "ronnie-demo-resume.txt",
    resumeParsedAt: new Date().toISOString(),
    resumeText:
      "Operations and aviation leader with experience coordinating teams, improving processes, and communicating under pressure.",
    targetCompany: "Altitude Pro Media",
    targetRole: "Operations Manager",
  },
  modeKey: "mock_interview",
  questionTypeKey: "behavioral",
  styleKey: "friendly",
};

const demoArtifact: VoiceSessionArtifactDraft = {
  durationSeconds: 545,
  endedAt: new Date().toISOString(),
  endReason: "user_ended",
  events: [],
  startedAt: new Date(Date.now() - 545000).toISOString(),
  transcript: [
    {
      createdAt: new Date(Date.now() - 500000).toISOString(),
      id: "demo-assistant-1",
      role: "assistant",
      speaker: "Que",
      text: "Tell me about a time you had to align people around a difficult operational decision.",
    },
    {
      createdAt: new Date(Date.now() - 450000).toISOString(),
      id: "demo-user-1",
      role: "user",
      speaker: "You",
      text: "I coordinated a last-minute schedule change across a small team, explained the tradeoffs, and kept the client updated while we protected quality.",
    },
  ],
};

const demoEvaluation: SessionEvaluationResult = {
  coachingInsight:
    "Your answer sounds credible and calm, but it needs a sharper result at the end.",
  coachingMemory: {
    evidenceCount: 2,
    growthAreas: ["Quantify outcomes more often", "Close answers with a clearer result"],
    latestRecommendation:
      "Practice ending each answer with the measurable outcome or business impact.",
    recurringPatterns: ["Strong operational context", "Results need more specificity"],
    strengths: ["Calm delivery", "Clear ownership", "Practical examples"],
    summary:
      "Ronnie explains operational situations clearly and sounds credible, with the biggest opportunity in making results more concrete.",
  },
  reviewDetail: {
    evidence: [
      "You named the tradeoffs and client communication clearly.",
      "The answer stayed focused on ownership, but the final outcome was broad.",
    ],
    focusAreas: [
      "Add one concrete result, such as saved time, reduced disruption, or client satisfaction.",
      "End with a cleaner lesson or business impact instead of stopping at the action.",
    ],
    followUpQuestions: [
      "What changed because you handled the schedule issue well?",
      "How would your manager or client describe the outcome?",
    ],
    practicePlan: [
      "Retell the same story in 90 seconds.",
      "Add one measurable or observable result in the final sentence.",
      "Record one version with a clearer closing lesson.",
    ],
    strengths: [
      "Calm, credible delivery",
      "Clear ownership of the operational problem",
      "Good connection to team and client needs",
    ],
  },
  nextAction: "Practice one behavioral answer with a measurable result in the final sentence.",
  scores: [
    {
      evidence: "The answer used steady language and avoided over-explaining.",
      key: "confidence",
      label: "Confidence",
      nextStep: "Keep the same calm tone while adding a sharper close.",
      score: 4,
      summary: "Calm and steady.",
    },
    {
      evidence: "The situation, action, and client update were easy to follow.",
      key: "clarity",
      label: "Clarity",
      nextStep: "Make the ending feel more complete.",
      score: 4,
      summary: "Easy to follow.",
    },
    {
      evidence: "The example matches operational leadership and team coordination.",
      key: "relevance",
      label: "Relevance",
      nextStep: "Tie the example directly to the target role in one sentence.",
      score: 4,
      summary: "Fits the role well.",
    },
    {
      evidence: "The answer described the actions but not the measurable outcome.",
      key: "impact",
      label: "Impact",
      nextStep: "Add a result the interviewer can remember.",
      score: 3,
      summary: "Needs a stronger result.",
    },
    {
      evidence: "The answer sounded personal and grounded in real work.",
      key: "authenticity",
      label: "Authenticity",
      nextStep: "Keep the natural tone and add a brief reflection.",
      score: 5,
      summary: "Sounds natural.",
    },
  ],
  summary:
    "A solid operational leadership answer with clear ownership and a natural tone.",
};

const demoStories = [
  {
    actions: [
      "Mapped the urgent constraints",
      "Aligned the team on the best tradeoff",
      "Kept the client informed through the change",
    ],
    alternateSpins: [
      {
        angle: "Leadership",
        question: "Tell me about a time you led through ambiguity.",
        whyItWorks: "Shows calm ownership and coordination.",
      },
      {
        angle: "Communication",
        question: "Tell me about a time you had to explain a difficult change.",
        whyItWorks: "Highlights expectation-setting under pressure.",
      },
    ],
    categories: ["leadership", "communication", "problem_solving"] as const,
    coachNotes: ["Add a measurable result before using this in a final interview."],
    practicePrompt: "Practice this as a 90-second leadership answer.",
    rawNotes: "Demo story seeded for UI review.",
    result: "The team protected quality and the client stayed informed.",
    situation: "A schedule changed late and created a delivery risk.",
    summary: "Coordinated a team through a last-minute operational change.",
    task: "Keep delivery on track while protecting quality.",
    title: "Last-minute schedule change",
  },
  {
    actions: [
      "Gathered feedback from the people closest to the workflow",
      "Built a simpler handoff checklist",
      "Reviewed the change with managers before rollout",
    ],
    alternateSpins: [
      {
        angle: "Ownership",
        question: "Tell me about a time you improved a process.",
        whyItWorks: "Shows initiative and practical execution.",
      },
      {
        angle: "Customer impact",
        question: "Tell me about a time your work improved the customer experience.",
        whyItWorks: "Connects internal process to external value.",
      },
    ],
    categories: ["ownership", "customer_impact", "communication"] as const,
    coachNotes: ["Open with the before/after difference so impact lands sooner."],
    practicePrompt: "Practice this as a process-improvement answer.",
    rawNotes: "Second demo story seeded for Story Lab UI review.",
    result: "Handoffs became more consistent and managers had fewer follow-up questions.",
    situation: "A recurring handoff gap was slowing down new project starts.",
    summary: "Improved a messy handoff process by simplifying the checklist.",
    task: "Reduce confusion without adding more administrative work.",
    title: "Cleaner project handoff",
  },
];

const demoIntroductions = [
  {
    audience: "virtual" as const,
    background:
      "I am an operations-focused leader who has spent the last several years coordinating people, process, and client expectations in high-pressure environments.",
    length: "medium" as const,
    proofPoint:
      "I have helped teams handle last-minute changes while protecting quality and keeping stakeholders informed.",
    rawNotes:
      "I want my intro to sound calm, credible, and connected to operations leadership. I want to mention team coordination and client communication.",
    roleInterest:
      "That is why I am interested in an Operations Manager role where execution, communication, and good judgment all matter.",
    script:
      "I am an operations-focused leader who has spent the last several years coordinating people, process, and client expectations in high-pressure environments. My strongest lane is bringing calm structure to messy situations. For example, I have helped teams handle last-minute changes while protecting quality and keeping stakeholders informed. That is why I am interested in an Operations Manager role where execution, communication, and good judgment all matter. I would be happy to start with the experience most similar to this role.",
    strength: "bringing calm structure to messy situations",
    title: "Operations manager intro",
    transition: "I would be happy to start with the experience most similar to this role.",
  },
  {
    audience: "hr_phone" as const,
    background:
      "I come from an operations and aviation background where clear communication and reliable follow-through are essential.",
    length: "short" as const,
    proofPoint:
      "I have repeatedly been trusted to coordinate teams when timing, quality, and client expectations all had to be balanced.",
    rawNotes:
      "Short recruiter version. Needs to be concise and easy to follow. Mention operations, aviation, communication.",
    roleInterest:
      "I am looking for a role where I can use that background to help a team run more smoothly.",
    script:
      "I come from an operations and aviation background where clear communication and reliable follow-through are essential. I am strongest at keeping people aligned when priorities shift. I have repeatedly been trusted to coordinate teams when timing, quality, and client expectations all had to be balanced. I am looking for a role where I can use that background to help a team run more smoothly.",
    strength: "keeping people aligned when priorities shift",
    title: "Short recruiter intro",
    transition: "I can share the example that best matches this role.",
  },
];

export async function seedRonnieDemoData(fallbackUserId: string) {
  const userId = await findRonnieUser(fallbackUserId);
  const now = new Date();
  const created: string[] = [];

  const [profile] = await getDb()
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!profile) {
    await getDb().insert(profiles).values({
      jobDescription: demoSnapshot.interviewContext.jobDescription,
      preferredName: demoSnapshot.interviewContext.preferredName,
      resumeName: demoSnapshot.interviewContext.resumeName,
      resumeParsedAt: now,
      resumeText: demoSnapshot.interviewContext.resumeText,
      targetCompany: demoSnapshot.interviewContext.targetCompany,
      targetRole: demoSnapshot.interviewContext.targetRole,
      updatedAt: now,
      userId,
    });
    created.push("profile");
  }

  const existingStories = await getDb()
    .select({ title: stories.title })
    .from(stories)
    .where(eq(stories.userId, userId));
  const existingStoryTitles = new Set(existingStories.map((story) => story.title));

  for (const story of demoStories) {
    if (existingStoryTitles.has(story.title)) {
      continue;
    }

    await getDb().insert(stories).values({
      ...story,
      categories: [...story.categories],
      updatedAt: now,
      userId,
    });
    created.push(`story:${story.title}`);
  }

  const existingIntroductions = await getDb()
    .select({ title: introductions.title })
    .from(introductions)
    .where(eq(introductions.userId, userId));
  const existingIntroductionTitles = new Set(
    existingIntroductions.map((introduction) => introduction.title),
  );

  for (const introduction of demoIntroductions) {
    if (existingIntroductionTitles.has(introduction.title)) {
      continue;
    }

    await getDb().insert(introductions).values({
      ...introduction,
      updatedAt: now,
      userId,
    });
    created.push(`introduction:${introduction.title}`);
  }

  let sessionId: string | undefined;
  const [existingEvaluation] = await getDb()
    .select({ sessionId: evaluations.sessionId })
    .from(evaluations)
    .where(eq(evaluations.userId, userId))
    .limit(1);

  if (existingEvaluation) {
    sessionId = existingEvaluation.sessionId;
  } else {
    const [session] = await getDb()
      .insert(sessions)
      .values({
        contextSnapshot: demoSnapshot,
        endedAt: now,
        evaluationStatus: "completed",
        modeKey: demoSnapshot.modeKey,
        questionTypeKey: demoSnapshot.questionTypeKey,
        startedAt: new Date(Date.now() - 545000),
        status: "evaluated",
        styleKey: demoSnapshot.styleKey,
        updatedAt: now,
        userId,
        voiceArtifact: demoArtifact,
      })
      .returning({ id: sessions.id });
    sessionId = session.id;
    await getDb().insert(evaluations).values({
      model: "demo",
      promptConfigKey: "session_evaluation",
      promptConfigVersion: 2,
      result: demoEvaluation,
      sessionId,
      updatedAt: now,
      userId,
    });
    await recordReviewProgression(userId, sessionId, demoEvaluation, demoArtifact);
    created.push("session", "evaluation", "progression");
  }

  const [memory] = await getDb()
    .select({ id: coachingMemory.id })
    .from(coachingMemory)
    .where(eq(coachingMemory.userId, userId))
    .limit(1);

  if (!memory) {
    await getDb().insert(coachingMemory).values({
      evidenceCount: demoEvaluation.coachingMemory?.evidenceCount ?? 1,
      growthAreas: demoEvaluation.coachingMemory?.growthAreas ?? [],
      lastSessionId: sessionId,
      latestRecommendation: demoEvaluation.coachingMemory?.latestRecommendation ?? "",
      memory: demoEvaluation.coachingMemory,
      recurringPatterns: demoEvaluation.coachingMemory?.recurringPatterns ?? [],
      strengths: demoEvaluation.coachingMemory?.strengths ?? [],
      summary: demoEvaluation.coachingMemory?.summary ?? "",
      updatedAt: now,
      userId,
    });
    created.push("coaching memory");
  }

  if (sessionId) {
    const [debrief] = await getDb()
      .select({ id: debriefs.id })
      .from(debriefs)
      .where(and(eq(debriefs.userId, userId), eq(debriefs.sessionId, sessionId)))
      .limit(1);

    if (!debrief) {
      await getDb().insert(debriefs).values({
        model: "demo",
        promptConfigKey: "session_debrief",
        promptConfigVersion: 2,
        result: {
          focusAreas: ["Add one measurable outcome", "Tighten the closing sentence"],
          followUpQuestion:
            "What number, customer outcome, or time saved could make this answer more concrete?",
          practicePlan: ["Rewrite the final sentence", "Practice it once in 90 seconds"],
          strengths: ["Clear ownership", "Calm operational framing"],
          summary:
            "This answer has a strong setup and credible action; the debrief focus is making impact specific.",
        },
        sessionId,
        updatedAt: now,
        userId,
        userNote: "Where should I make this answer stronger?",
      });
      created.push("debrief");
    }
  }

  const [feedback] = await getDb()
    .select({ id: userFeedback.id })
    .from(userFeedback)
    .where(eq(userFeedback.userId, userId))
    .limit(1);

  if (!feedback) {
    await getDb().insert(userFeedback).values({
      kind: "feedback",
      message: "Demo feedback row for Admin UI review.",
      rating: 4,
      ratingPrompt: "How useful is QuesIQ so far?",
      screen: "home",
      status: "new",
      updatedAt: now,
      userId,
    });
    created.push("feedback");
  }

  return {
    created,
    userId,
  };
}
