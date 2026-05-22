import { eq } from "drizzle-orm";

import type { VoiceSessionArtifactDraft } from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { sessions } from "@/server/db/schema";

function toDate(value?: string) {
  return value ? new Date(value) : undefined;
}

export async function saveSessionArtifact(
  sessionId: string,
  artifact: VoiceSessionArtifactDraft,
) {
  const [session] = await getDb()
    .update(sessions)
    .set({
      endedAt: toDate(artifact.endedAt),
      startedAt: toDate(artifact.startedAt),
      status: "artifact_saved",
      updatedAt: new Date(),
      voiceArtifact: artifact,
    })
    .where(eq(sessions.id, sessionId))
    .returning({
      id: sessions.id,
      status: sessions.status,
    });

  return session;
}
