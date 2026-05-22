import { and, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { sessions } from "@/server/db/schema";

export async function getOwnedSession(sessionId: string, userId: string) {
  const [session] = await getDb()
    .select({
      id: sessions.id,
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  return session;
}
