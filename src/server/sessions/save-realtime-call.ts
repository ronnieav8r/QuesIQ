import { and, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { sessions } from "@/server/db/schema";

export async function saveRealtimeCallId(
  sessionId: string,
  userId: string,
  realtimeCallId: string,
) {
  return saveRealtimeSessionConfig(sessionId, userId, { realtimeCallId });
}

export async function saveRealtimeSessionConfig(
  sessionId: string,
  userId: string,
  config: {
    model?: string;
    promptConfigKey?: string;
    promptConfigVersion?: number;
    realtimeCallId?: string;
    voice?: string;
  },
) {
  const [session] = await getDb()
    .update(sessions)
    .set({
      realtimeCallId: config.realtimeCallId,
      realtimeModel: config.model,
      realtimePromptConfigKey: config.promptConfigKey,
      realtimePromptConfigVersion: config.promptConfigVersion,
      realtimeVoice: config.voice,
      updatedAt: new Date(),
    })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning({ id: sessions.id });

  return session;
}
