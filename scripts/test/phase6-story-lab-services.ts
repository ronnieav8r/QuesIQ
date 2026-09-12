import "./interview-synthetic";
import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { saveLabMaterial, readStoryLab, deleteLabMaterial, resolveStoryPreparation, resolveLegacySavedPreparation } from "@/server/interview/story-lab";
import { materialFieldsSchema } from "@quesiq/interview-contracts";
import { updateStory } from "@/server/stories/stories";
import { parseSessionSetupSnapshot } from "@/product/session-snapshot";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? ""); assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.port === "5433");
  const ids = [randomUUID(), randomUUID()]; const [owner, stranger] = ids; const db = getDb();
  const originalFetch = globalThis.fetch; globalThis.fetch = async () => { throw new Error("Unexpected provider request"); };
  try {
    await db.insert(users).values(ids.map(id => ({ id, email: `p62-${id}@example.test`, name: "Synthetic Story Lab" })));
    const fields = materialFieldsSchema.parse({ title: "Real teamwork", rawNotes: "I helped a colleague.", categories: ["teamwork"], practicePrompt: "Tell me about helping a colleague." });
    let saved = await saveLabMaterial(owner, { id: randomUUID(), kind: "story", revision: 0, fields, reviewed: true });
    assert.equal(saved.aiAssisted, false); assert.equal(saved.rawNotes, fields.rawNotes);
    await assert.rejects(saveLabMaterial(stranger, { id: saved.id, kind: "story", revision: saved.revision, fields, reviewed: true }), /not found/);
    await assert.rejects(saveLabMaterial(owner, { id: saved.id, kind: "story", revision: 0, fields: { ...fields, title: "Conflicting stale edit" }, reviewed: true }), /changed/);
    const snapshot = { interviewContext: { preferredName: "", targetRole: "", targetCompany: "", jobDescription: "" }, modeKey: "coaching" as const, styleKey: "friendly" as const, preparationSelections: { storyId: saved.id, useSavedStories: true } };
    const frozen = await resolveStoryPreparation(owner, snapshot);
    assert.equal(frozen.storyContext?.practicePrompt, fields.practicePrompt);
    const legacy = await resolveLegacySavedPreparation(owner, { ...snapshot, preparationSelections: undefined, storyContext: { ...frozen.storyContext!, summary: "Forged client facts" } });
    assert.notEqual(legacy.storyContext?.summary, "Forged client facts", "Saved legacy IDs use owned server facts");
    await assert.rejects(resolveLegacySavedPreparation(stranger, { ...snapshot, preparationSelections: undefined, storyContext: frozen.storyContext }), /no longer available/);
    await assert.rejects(resolveStoryPreparation(stranger, snapshot), /Review and save/);
    for (let i = 0; i < 5; i++) await saveLabMaterial(owner, { id: randomUUID(), kind: "story", revision: 0, fields: { ...fields, title: `Story ${i}` }, reviewed: i !== 0 });
    const general = await resolveStoryPreparation(owner, { ...snapshot, preparationSelections: { useSavedStories: true } });
    assert.equal(general.frozenStoryLibrary?.length, 3);
    assert.deepEqual(general.reviewedMaterialVersions, (await resolveStoryPreparation(owner, { ...snapshot, preparationSelections: { useSavedStories: true } })).reviewedMaterialVersions);
    assert.equal((await resolveStoryPreparation(owner, { ...snapshot, preparationSelections: { useSavedStories: false } })).frozenStoryLibrary?.length, 0);
    const intro = await saveLabMaterial(owner, { id: randomUUID(), kind: "introduction", revision: 0, fields: { title: "Opening", rawNotes: "Actual background", script: "I am a pilot." }, reviewed: true });
    assert.equal(intro.audience, "virtual"); assert.equal(intro.length, "medium");
    assert.equal((await resolveStoryPreparation(owner, { ...snapshot, modeKey: "first_impression", preparationSelections: { introductionId: intro.id, useSavedStories: true } })).introductionContext?.script, intro.script);
    await assert.rejects(resolveStoryPreparation(owner, { ...snapshot, preparationSelections: { introductionId: intro.id, useSavedStories: true } }), /First Impression/);
    await updateStory(owner, saved.id, "web changed", { ...fields, coachNotes: [], alternateSpins: [] });
    saved = (await readStoryLab(owner)).stories.find(item => item.id === saved.id)!; assert.equal(saved.reviewedAt, null); assert.equal(saved.revision, 2);
    await assert.rejects(resolveStoryPreparation(owner, snapshot), /Review and save/);
    await deleteLabMaterial(owner, { kind: "story", id: saved.id, revision: saved.revision });
    assert.equal(frozen.storyContext?.practicePrompt, fields.practicePrompt, "Historical copy changed on deletion");
    assert.equal((await readStoryLab(stranger)).stories.length, 0);
    assert.equal(parseSessionSetupSnapshot({ ...snapshot, preparationSelections: { storyId: "invalid" } }), undefined);
    console.log("P6.2 services passed: manual save, ownership, revisions, reviewed selection, deterministic limit, off toggle, introduction defaults, legacy-edit invalidation and historical deletion.");
  } finally { globalThis.fetch = originalFetch; await db.delete(users).where(inArray(users.id, ids)); await (globalThis as typeof globalThis & { quesiqPool?: { end(): Promise<void> } }).quesiqPool?.end(); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
