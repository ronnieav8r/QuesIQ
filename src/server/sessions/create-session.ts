import { getDb } from "@/server/db/client";
import { sessions } from "@/server/db/schema";
import type { SessionSetupSnapshot } from "@/product/interview-types";

export async function createSession(snapshot: SessionSetupSnapshot) {
  const [session] = await getDb()
    .insert(sessions)
    .values({
      contextSnapshot: snapshot,
      modeKey: snapshot.modeKey,
      questionTypeKey: snapshot.questionTypeKey,
      styleKey: snapshot.styleKey,
    })
    .returning({
      id: sessions.id,
      status: sessions.status,
    });

  return session;
}
