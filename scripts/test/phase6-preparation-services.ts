import "./interview-synthetic";
import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { profiles, users } from "@/server/db/schema";
import { mutatePreparation, readPreparation, resolvePreparationContext } from "@/server/profiles/preparation";
import { saveProfile } from "@/server/profiles/save-profile";
import { createPreparationDraft } from "@/server/profiles/preparation-drafts";
import { POST as extract } from "@/app/api/mobile/v1/interview/preparation/resume/extract/route";
import { issueMobileTokenPair } from "@/server/mobile-auth/mobile-auth";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.port === "5433", "Local QuesIQ database required");
  const ids = [randomUUID(), randomUUID()]; const [owner, stranger] = ids;
  const realFetch = globalThis.fetch; globalThis.fetch = async () => { throw new Error("Unexpected provider request"); };
  const db = getDb();
  try {
    await db.insert(users).values(ids.map(id => ({ id, email: `p6-${id}@example.test`, name: "Synthetic preparation" })));
    let state = await mutatePreparation(owner, { revision: 0, change: { action: "name", preferredName: "Rae" } });
    assert.equal(state.profile?.preferredName, "Rae");
    state = await mutatePreparation(owner, { revision: state.revision, change: { action: "resume_confirm", name: "typed.txt", text: "I led a project and delivered an accurate result." } });
    const original = state.profile?.resumeText;
    await saveProfile(owner, { preferredName: "Rae", jobDescription: "", targetRole: "", targetCompany: "" });
    state = await readPreparation(owner); assert.equal(state.profile?.resumeText, original, "Omitted text erased resume");
    await assert.rejects(mutatePreparation(owner, { revision: 0, change: { action: "name", preferredName: "Stale" } }), /changed/);
    const concurrent = await Promise.allSettled(["One", "Two"].map(preferredName => mutatePreparation(owner, { revision: state.revision, change: { action: "name", preferredName } })));
    assert.equal(concurrent.filter(r => r.status === "fulfilled").length, 1, "Concurrent edit was not rejected");
    state = await readPreparation(owner);
    state = await mutatePreparation(owner, { revision: state.revision, change: { action: "target_save", targetRole: "Pilot", targetCompany: "Example", jobDescription: "Safety" } });
    const target = state.targets[0]; assert.equal(state.profile?.jobTargetId, undefined);
    await assert.rejects(mutatePreparation(stranger, { revision: 0, change: { action: "target_active", id: target.id } }), /not found/);
    state = await mutatePreparation(owner, { revision: state.revision, change: { action: "target_active", id: target.id } });
    const snapshot = { interviewContext: { preferredName: "Spoof", targetRole: "Spoof", targetCompany: "Spoof", jobDescription: "Spoof", jobTargetId: target.id, resumeText: "Spoof" }, modeKey: "coaching" as const, styleKey: "friendly" as const };
    const resolved = await resolvePreparationContext(owner, snapshot);
    assert.equal(resolved.interviewContext.targetRole, "Pilot"); assert.equal(resolved.interviewContext.resumeText, original);
    await assert.rejects(resolvePreparationContext(stranger, snapshot), /no longer available/);
    const token = await issueMobileTokenPair({ id: owner, email: `p6-${owner}@example.test`, name: "Synthetic preparation" }); const form = new FormData(); form.set("resume", new File(["Replacement notes"], "resume.txt", { type: "text/plain" }));
    const response = await extract(new Request("http://localhost/api/mobile/v1/interview/preparation/resume/extract", { method: "POST", headers: { Authorization: `Bearer ${token.accessToken}` }, body: form }));
    assert.equal(response.status, 200); assert.equal((await response.json()).text, "Replacement notes");
    assert.equal((await readPreparation(owner)).profile?.resumeText, original, "Extraction replaced confirmed resume");
    const badForm = new FormData(); badForm.set("resume", new File(["junk"], "resume.pdf", { type: "application/pdf" }));
    assert.equal((await extract(new Request("http://localhost/extract", { method: "POST", headers: { Authorization: `Bearer ${token.accessToken}` }, body: badForm }))).status, 400);
    assert.equal((await readPreparation(owner)).profile?.resumeText, original);
    let calls = 0; const draftInput = { userId: owner, id: randomUUID(), kind: "resume_summary", revision: state.revision, source: "notes", generate: async () => { calls++; return { summary: { currentOrRecentRole: "Pilot" } }; } };
    await createPreparationDraft(draftInput); await createPreparationDraft(draftInput); assert.equal(calls, 1);
    await assert.rejects(createPreparationDraft({ ...draftInput, source: "changed" }), /different notes/);
    state = await mutatePreparation(owner, { revision: state.revision, change: { action: "target_delete", id: target.id } });
    assert.equal(state.profile?.jobTargetId, undefined); assert.equal(state.profile?.targetRole, ""); assert.equal(state.profile?.jobDescription, "");
    assert.equal(resolved.interviewContext.targetRole, "Pilot", "Historical snapshot changed");
    state = await mutatePreparation(owner, { revision: state.revision, change: { action: "resume_remove" } }); assert.equal(state.profile?.resumeText, undefined);
    assert.equal((await readPreparation(stranger)).profile, undefined);
    assert.equal((await db.select().from(profiles).where(eq(profiles.userId, owner)))[0].resumeSummary, null);
    console.log("P6.1 preparation services passed: preservation, revisions/concurrency, ownership, snapshot, extraction, draft replay, deletion.");
  } finally { globalThis.fetch = realFetch; await db.delete(users).where(inArray(users.id, ids)); await (globalThis as typeof globalThis & { quesiqPool?: { end(): Promise<void> } }).quesiqPool?.end(); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
