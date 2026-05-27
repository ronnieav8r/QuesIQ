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
  nextAction: "Practice one behavioral answer with a measurable result in the final sentence.",
  scores: [
    { key: "confidence", label: "Confidence", score: 4, summary: "Calm and steady." },
    { key: "clarity", label: "Clarity", score: 4, summary: "Easy to follow." },
    { key: "relevance", label: "Relevance", score: 4, summary: "Fits the role well." },
    { key: "impact", label: "Impact", score: 3, summary: "Needs a stronger result." },
    { key: "authenticity", label: "Authenticity", score: 5, summary: "Sounds natural." },
  ],
  summary:
    "A solid operational leadership answer with clear ownership and a natural tone.",
};

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

  const [story] = await getDb()
    .select({ id: stories.id })
    .from(stories)
    .where(eq(stories.userId, userId))
    .limit(1);

  if (!story) {
    await getDb().insert(stories).values({
      actions: ["Mapped the urgent constraints", "Aligned the team", "Kept the client informed"],
      alternateSpins: [
        {
          angle: "Leadership",
          question: "Tell me about a time you led through ambiguity.",
          whyItWorks: "Shows calm ownership and coordination.",
        },
      ],
      categories: ["leadership", "communication", "problem_solving"],
      coachNotes: ["Add a measurable result before using this in a final interview."],
      practicePrompt: "Practice this as a 90-second leadership answer.",
      rawNotes: "Demo story seeded for UI review.",
      result: "The team protected quality and the client stayed informed.",
      situation: "A schedule changed late and created a delivery risk.",
      summary: "Coordinated a team through a last-minute operational change.",
      task: "Keep delivery on track while protecting quality.",
      title: "Last-minute schedule change",
      updatedAt: now,
      userId,
    });
    created.push("story");
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
