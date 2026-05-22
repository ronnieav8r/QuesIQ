import { eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { sessions } from "@/server/db/schema";

export async function saveRealtimeCallId(sessionId: string, realtimeCallId: string) {
  await getDb()
    .update(sessions)
    .set({
      realtimeCallId,
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));
}
