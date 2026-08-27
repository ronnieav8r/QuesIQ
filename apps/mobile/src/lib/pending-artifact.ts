import {
  voiceSessionArtifactSchema,
  type VoiceSessionArtifact,
} from "@quesiq/interview-contracts";
import { Directory, File, Paths } from "expo-file-system";

export type PendingArtifactRecord = {
  artifact: VoiceSessionArtifact;
  createdAt: string;
  sessionId: string;
};

const pendingDirectory = new Directory(Paths.document, "pending-session-artifacts");

function fileForSession(sessionId: string) {
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return new File(pendingDirectory, `${safeSessionId}.json`);
}

export function savePendingArtifact(record: PendingArtifactRecord) {
  pendingDirectory.create({ idempotent: true, intermediates: true });
  const file = fileForSession(record.sessionId);
  if (!file.exists) file.create({ intermediates: true });
  file.write(JSON.stringify(record));
}

export function deletePendingArtifact(sessionId: string) {
  const file = fileForSession(sessionId);
  if (file.exists) file.delete();
}

export async function listPendingArtifacts(): Promise<PendingArtifactRecord[]> {
  if (!pendingDirectory.exists) return [];

  const records = await Promise.all(pendingDirectory.list().map(async (entry) => {
    if (!(entry instanceof File) || entry.extension !== ".json") return undefined;
    try {
      const value = JSON.parse(await entry.text()) as Partial<PendingArtifactRecord>;
      const artifact = voiceSessionArtifactSchema.safeParse(value.artifact);
      if (!artifact.success || typeof value.sessionId !== "string" || !value.sessionId) {
        return undefined;
      }
      return {
        artifact: artifact.data,
        createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
        sessionId: value.sessionId,
      } satisfies PendingArtifactRecord;
    } catch {
      return undefined;
    }
  }));

  return records.filter((record): record is PendingArtifactRecord => Boolean(record));
}
