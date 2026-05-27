import { getDb } from "@/server/db/client";
import { sessions } from "@/server/db/schema";
import type { SessionSetupSnapshot } from "@/product/interview-types";
import { markJobTargetUsed } from "@/server/job-targets/job-targets";

export async function createSession(snapshot: SessionSetupSnapshot, userId: string) {
  const [session] = await getDb()
    .insert(sessions)
    .values({
      contextSnapshot: snapshot,
      modeKey: snapshot.modeKey,
      questionTypeKey: snapshot.questionTypeKey,
      styleKey: snapshot.styleKey,
      userId,
    })
    .returning({
      id: sessions.id,
      status: sessions.status,
    });

  await markJobTargetUsed(userId, snapshot.interviewContext.jobTargetId);

  return session;
}
