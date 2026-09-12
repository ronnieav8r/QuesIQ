import { getDb } from "@/server/db/client";
import { sessions } from "@/server/db/schema";
import type { SessionSetupSnapshot } from "@/product/interview-types";
import { markJobTargetUsed } from "@/server/job-targets/job-targets";
import { markQuestionAttemptsStarted } from "@/server/interview/question-bank";

export async function createSession(snapshot: SessionSetupSnapshot, userId: string, provenance: "learner" | "test_tunnel" | "synthetic" | "legacy_unknown" = "legacy_unknown") {
  const selectedQuestionQueue = snapshot.selectedQuestionQueueContext?.length
    ? snapshot.selectedQuestionQueueContext
    : snapshot.selectedQuestionContext
      ? [snapshot.selectedQuestionContext]
      : [];
  const [session] = await getDb()
    .insert(sessions)
    .values({
      contextSnapshot: snapshot,
      practiceProvenance: provenance,
      provenanceVersion: provenance === "legacy_unknown" ? null : 1,
      modeKey: snapshot.modeKey,
      questionTypeKey: snapshot.questionTypeKey,
      selectedQuestionId: selectedQuestionQueue[0]?.id,
      styleKey: snapshot.styleKey,
      userId,
    })
    .returning({
      id: sessions.id,
      status: sessions.status,
    });

  await markJobTargetUsed(userId, snapshot.interviewContext.jobTargetId);
  if (selectedQuestionQueue.length > 0) {
    await markQuestionAttemptsStarted({
      questionIds: selectedQuestionQueue.map((question) => question.id),
      sessionId: session.id,
      userId,
    });
  }

  return session;
}
