import { cleanupExpiredCoachingAudio, deletePendingArtifact, listPendingArtifacts, savePendingArtifact } from "./pending-artifact";
import { beforeEach, expect, jest, test } from "@jest/globals";
const mockFiles = new Map<string, string>();
let mockFailWrite = false, mockFailMove = false, mockFailDelete = false;
jest.mock("expo-file-system", () => {
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) { this.uri = parts.map((part) => typeof part === "string" ? part : (part as Directory).uri).join("/"); }
    get exists() { return true; }
    create() {}
    list() { return [...mockFiles.keys()].filter((path) => path.startsWith(this.uri + "/")).map((path) => new File(path)); }
  }
  class File {
    uri: string;
    constructor(...parts: unknown[]) { this.uri = parts.map((part) => typeof part === "string" ? part : (part as Directory).uri).join("/"); }
    get exists() { return mockFiles.has(this.uri); }
    get name() { return this.uri.split("/").at(-1)!; }
    get extension() { return "." + this.name.split(".").at(-1); }
    create() { if (this.exists) throw new Error("exists"); mockFiles.set(this.uri, ""); }
    write(value: string) { mockFiles.set(this.uri, mockFailWrite ? "partial" : value); if (mockFailWrite) throw new Error("disk full"); }
    textSync() { return mockFiles.get(this.uri)!; }
    async text() { return this.textSync(); }
    move(file: File) { if (mockFailMove) throw new Error("rename failed"); mockFiles.set(file.uri, this.textSync()); mockFiles.delete(this.uri); this.uri = file.uri; }
    delete() { if (mockFailDelete) throw new Error("delete failed"); mockFiles.delete(this.uri); }
  }
  return { Directory, File, Paths: { document: "document", cache: "cache" } };
});
const record = (ownerId = "owner-a", text = "committed") => ({ ownerId, sessionId: "session-1", createdAt: "2026-09-08T12:00:00Z", phase: "active" as const, artifact: { endedAt: "2026-09-08T12:00:00Z", events: [], transcript: [{ id: "a", createdAt: "2026-09-08T12:00:00Z", speaker: "You" as const, role: "user" as const, text }] } });
beforeEach(() => { mockFiles.clear(); mockFailWrite = false; mockFailMove = false; mockFailDelete = false; });
test("restart reads only the owning account's newest verified generation", async () => {
  savePendingArtifact(record()); savePendingArtifact(record("owner-b", "other account")); savePendingArtifact(record("owner-a", "new committed answer"));
  expect((await listPendingArtifacts("owner-a"))).toEqual([record("owner-a", "new committed answer")]);
  deletePendingArtifact("session-1", "owner-a");
  expect(await listPendingArtifacts("owner-a")).toEqual([]);
  expect(await listPendingArtifacts("owner-b")).toHaveLength(1);
});
test.each(["write", "move"])("failed %s retains the previous valid checkpoint", async (failure) => {
  savePendingArtifact(record()); mockFailWrite = failure === "write"; mockFailMove = failure === "move";
  expect(() => savePendingArtifact(record("owner-a", "new"))).toThrow();
  expect(await listPendingArtifacts("owner-a")).toEqual([record()]);
});
test("corrupt latest generation falls back while legacy and foreign copies stay untouched", async () => {
  savePendingArtifact(record()); mockFailDelete = true; savePendingArtifact(record("owner-a", "new"));
  const latest = [...mockFiles.keys()].sort().at(-1)!; mockFiles.set(latest, "broken");
  mockFiles.set("document/pending-session-artifacts/legacy.json", JSON.stringify({ ...record(), ownerId: undefined }));
  expect(await listPendingArtifacts("owner-a")).toEqual([record()]);
  expect(mockFiles.has(latest)).toBe(true);
});
test("unsafe identifiers and invalid artifacts cannot replace a valid copy", async () => {
  savePendingArtifact(record());
  expect(() => savePendingArtifact({ ...record(), sessionId: "../other" })).toThrow();
  expect(() => savePendingArtifact({ ...record(), ownerId: undefined })).toThrow();
  expect(await listPendingArtifacts("owner-a")).toEqual([record()]);
});


test("legacy records are retained until an owned server lookup permits migration", async () => {
  const legacy = { ...record(), ownerId: undefined };
  const path = "document/pending-session-artifacts/session-1.json";
  mockFiles.set(path, JSON.stringify(legacy));
  expect(await listPendingArtifacts("owner-a")).toHaveLength(1);
  savePendingArtifact(record());
  expect(await listPendingArtifacts("owner-a")).toHaveLength(1);
  deletePendingArtifact("session-1", "owner-a", true);
  expect(mockFiles.has(path)).toBe(false);
});
test("expired audio cleanup touches only owned temporary naming patterns", () => {
  mockFiles.set("cache/quesiq-coaching-1-100.mp3", "expired");
  mockFiles.set("cache/quesiq-stream-spike-v1-100.wav", "expired");
  mockFiles.set("cache/quesiq-coaching-1-100000000.mp3", "recent");
  mockFiles.set("cache/other-product-100.mp3", "keep");
  cleanupExpiredCoachingAudio(100000000);
  expect([...mockFiles.keys()].sort()).toEqual(["cache/other-product-100.mp3", "cache/quesiq-coaching-1-100000000.mp3"]);
});
