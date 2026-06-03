import { getDb } from "@/server/db/client";
import { sessions } from "@/server/db/schema";
import type { SessionSetupSnapshot } from "@/product/interview-types";
import { markJobTargetUsed } from "@/server/job-targets/job-targets";
import { markQuestionAttemptStarted } from "@/server/interview/question-bank";

export async function createSession(snapshot: SessionSetupSnapshot, userId: string) {
  const [session] = await getDb()
    .insert(sessions)
    .values({
      contextSnapshot: snapshot,
      modeKey: snapshot.modeKey,
      questionTypeKey: snapshot.questionTypeKey,
      selectedQuestionId: snapshot.selectedQuestionContext?.id,
      styleKey: snapshot.styleKey,
      userId,
    })
    .returning({
      id: sessions.id,
      status: sessions.status,
    });

  await markJobTargetUsed(userId, snapshot.interviewContext.jobTargetId);
  if (snapshot.selectedQuestionContext?.id) {
    await markQuestionAttemptStarted({
      questionId: snapshot.selectedQuestionContext.id,
      sessionId: session.id,
      userId,
    });
  }

  return session;
}
