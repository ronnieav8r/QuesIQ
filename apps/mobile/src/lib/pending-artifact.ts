import { voiceSessionArtifactSchema, type VoiceSessionArtifact } from "@quesiq/interview-contracts";
import { Directory, File, Paths } from "expo-file-system";

export type PendingArtifactRecord = {
  artifact: VoiceSessionArtifact; createdAt: string; sessionId: string;
  ownerId?: string; phase?: "active" | "finalized"; serverSaved?: boolean;
};
const pendingDirectory = new Directory(Paths.document, "pending-session-artifacts");
const key = (value: string) => { if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new Error("Invalid recovery identifier"); return value; };
function prefix(sessionId: string, ownerId: string) { return `v2-${key(ownerId).length}-${ownerId}-${key(sessionId).length}-${sessionId}--`; }
function parse(text: string): PendingArtifactRecord {
  if (text.length > 4_000_000) throw new Error("Recovery copy too large");
  const value = JSON.parse(text) as PendingArtifactRecord;
  key(value.sessionId);
  if (value.ownerId !== undefined) key(value.ownerId);
  if (typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt))) throw new Error("Invalid recovery timestamp");
  if (value.phase !== undefined && !["active", "finalized"].includes(value.phase)) throw new Error("Invalid recovery phase");
  return { artifact: voiceSessionArtifactSchema.parse(value.artifact), sessionId: value.sessionId, createdAt: value.createdAt,
    ...(value.ownerId ? { ownerId: value.ownerId } : {}), ...(value.phase ? { phase: value.phase } : {}),
    ...(value.serverSaved === true ? { serverSaved: true } : {}) };
}
/** Commit a new generation before deleting the previous one; never overwrite the sole copy. */
export function savePendingArtifact(record: PendingArtifactRecord) {
  if (!record.ownerId) throw new Error("Sign in before staging a recovery copy");
  const text = JSON.stringify(parse(JSON.stringify(record)));
  pendingDirectory.create({ idempotent: true, intermediates: true });
  const base = prefix(record.sessionId, record.ownerId);
  const generations = pendingDirectory.list().filter((entry) => entry.name.startsWith(base)).map((entry) => Number(entry.name.slice(base.length).split(".")[0])).filter(Number.isSafeInteger);
  const generation = Math.max(Date.now(), ...generations.map((value) => value + 1));
  const name = `${base}${String(generation).padStart(16, "0")}`;
  const temp = new File(pendingDirectory, `${name}.tmp`);
  const committed = new File(pendingDirectory, `${name}.json`);
  try {
    temp.create(); temp.write(text);
    if (temp.textSync() !== text) throw new Error("Recovery verification failed");
    temp.move(committed);
  } catch (error) { try { if (temp.exists) temp.delete(); } catch {} throw error; }
  // A deletion failure leaves an older valid generation, never destroys the new one.
  try { for (const entry of pendingDirectory.list()) {
    if (entry instanceof File && entry.name.startsWith(base) && entry.name !== committed.name) {
      try { entry.delete(); } catch { /* Retry cleanup on the next checkpoint. */ }
    }
  } } catch { /* The verified committed copy is already durable at API level. */ }
}
export function deletePendingArtifact(sessionId: string, ownerId: string, includeVerifiedLegacy = false) {
  const base = prefix(sessionId, ownerId);
  if (!pendingDirectory.exists) return;
  for (const entry of pendingDirectory.list()) if (entry instanceof File && (entry.name.startsWith(base) || (includeVerifiedLegacy && entry.name === `${key(sessionId)}.json`))) entry.delete();
}
export async function listPendingArtifacts(ownerId?: string): Promise<PendingArtifactRecord[]> {
  if (!pendingDirectory.exists) return [];
  const latest = new Map<string, PendingArtifactRecord>();
  const entries = pendingDirectory.list().filter((entry): entry is File => entry instanceof File && entry.extension === ".json").sort((a, b) => b.name.localeCompare(a.name));
  for (const entry of entries) {
    try {
      const value = parse(await entry.text());
      // Legacy files require an owned server lookup before any transcript upload.
      if (ownerId && value.ownerId && (value.ownerId !== ownerId || !entry.name.startsWith(prefix(value.sessionId, ownerId)))) continue;
      if (!value.ownerId && entry.name !== `${value.sessionId}.json`) continue;
      const id = `${value.ownerId ?? ownerId ?? "legacy"}/${value.sessionId}`;
      if (!latest.has(id) || (value.ownerId && !latest.get(id)?.ownerId)) latest.set(id, value);
    } catch { /* Keep corrupt/partial files for diagnosis; a previous valid generation can recover. */ }
  }
  return [...latest.values()];
}


export function cleanupExpiredCoachingAudio(now = Date.now()) {
  const cache = new Directory(Paths.cache);
  if (!cache.exists) return;
  for (const entry of cache.list()) {
    if (!(entry instanceof File)) continue;
    const match = /^(?:quesiq-coaching-\d+|quesiq-stream-spike-v1)-(\d+)\.(?:mp3|wav)$/.exec(entry.name);
    if (match && now - Number(match[1]) > 86_400_000) {
      try { entry.delete(); } catch { /* Retry next foreground; OS cache eviction remains available. */ }
    }
  }
}
