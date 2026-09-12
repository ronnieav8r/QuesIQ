import "./interview-synthetic";
import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";

import { GET as storyLabGet, PUT as storyLabPut, DELETE as storyLabDelete } from "@/app/api/mobile/v1/interview/story-lab/route";
import { POST as draftPost } from "@/app/api/mobile/v1/interview/story-lab/draft/route";
import { getDb } from "@/server/db/client";
import { interviewPreparationDrafts, users } from "@/server/db/schema";
import { issueMobileTokenPair } from "@/server/mobile-auth/mobile-auth";
import { materialFieldsSchema } from "@quesiq/interview-contracts";

function request(method: string, token?: string, body?: unknown) {
  return new Request("http://local.test/api/mobile/v1/interview/story-lab", {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function errorCode(response: Response) {
  const body = await response.json() as { error?: { code?: string } };
  return body.error?.code;
}

async function main() {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(["localhost", "127.0.0.1"].includes(databaseUrl.hostname) && databaseUrl.port === "5433", "Tests require loopback Postgres port 5433.");

  const ownerId = randomUUID();
  const strangerId = randomUUID();
  const db = getDb();
  const failures: string[] = [];
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls++;
    throw new Error("Unexpected provider request in Story Lab API tests.");
  };

  try {
    await db.insert(users).values([
      { id: ownerId, email: `p62-api-owner-${ownerId}@example.test`, name: "Story Lab API owner" },
      { id: strangerId, email: `p62-api-stranger-${strangerId}@example.test`, name: "Story Lab API stranger" },
    ]);
    const ownerToken = await issueMobileTokenPair({ id: ownerId, email: `p62-api-owner-${ownerId}@example.test`, name: "Owner" });
    const strangerToken = await issueMobileTokenPair({ id: strangerId, email: `p62-api-stranger-${strangerId}@example.test`, name: "Stranger" });

    for (const method of ["GET", "PUT", "DELETE"]) {
      const response = await (method === "GET" ? storyLabGet : method === "PUT" ? storyLabPut : storyLabDelete)(request(method, "invalid-token", method === "PUT" ? {} : method === "DELETE" ? {} : undefined));
      assert.equal(response.status, 401, `Unauthenticated ${method} must be rejected.`);
    }

    const fields = materialFieldsSchema.parse({
      title: "Safe handoff",
      rawNotes: "I helped a colleague complete a safe handoff.",
      categories: ["teamwork"],
      practicePrompt: "Tell me about a safe handoff.",
    });
    const id = randomUUID();
    const createPayload = { id, kind: "story" as const, revision: 0, fields, reviewed: true };
    const createdResponse = await storyLabPut(request("PUT", ownerToken.accessToken, createPayload));
    assert.equal(createdResponse.status, 200, "Owner must be able to create a Story Lab story.");
    const created = await createdResponse.json() as { id: string; revision: number; reviewedAt: string | null; aiAssisted: boolean };
    assert.equal(created.id, id);
    assert.equal(created.revision, 1);
    assert.ok(created.reviewedAt, "Reviewed manual save must persist reviewedAt.");
    assert.equal(created.aiAssisted, false, "Manual save must not be marked AI-assisted.");
    assert.equal(providerCalls, 0, "Manual save called an AI provider.");

    const strangerRead = await storyLabGet(request("GET", strangerToken.accessToken));
    const strangerLibrary = await strangerRead.json() as { stories: Array<{ id: string }> };
    assert.equal(strangerRead.status, 200);
    assert.equal(strangerLibrary.stories.some((story) => story.id === id), false, "Foreign Story Lab row leaked through GET.");
    const foreignPut = await storyLabPut(request("PUT", strangerToken.accessToken, { ...createPayload, revision: 1 }));
    assert.equal(foreignPut.status, 404, "Cross-account PUT must not update a Story Lab row.");
    const foreignDelete = await storyLabDelete(request("DELETE", strangerToken.accessToken, { id, kind: "story", revision: 1 }));
    assert.equal(foreignDelete.status, 409, "Cross-account DELETE must not delete a Story Lab row.");

    const invalidActions = await storyLabPut(request("PUT", ownerToken.accessToken, { ...createPayload, id: randomUUID(), fields: { ...fields, actions: ["x".repeat(4001)] } }));
    assert.equal(invalidActions.status, 400, "Oversized action array item must be rejected.");
    const invalidCategories = await storyLabPut(request("PUT", ownerToken.accessToken, { ...createPayload, id: randomUUID(), fields: { ...fields, categories: ["not-a-category"] } }));
    assert.equal(invalidCategories.status, 400, "Unknown story category must be rejected.");
    const tooManyCategories = await storyLabPut(request("PUT", ownerToken.accessToken, { ...createPayload, id: randomUUID(), fields: { ...fields, categories: Array.from({ length: 13 }, () => "teamwork") } }));
    assert.equal(tooManyCategories.status, 400, "More than twelve categories must be rejected.");
    const invalidKind = await storyLabPut(request("PUT", ownerToken.accessToken, { ...createPayload, id: randomUUID(), kind: "bogus" }));
    assert.equal(invalidKind.status, 400, "Unknown material kind must be rejected.");

    const stalePut = await storyLabPut(request("PUT", ownerToken.accessToken, { ...createPayload, fields: { ...fields, title: "Stale edit" } }));
    assert.equal(stalePut.status, 409, "Stale PUT must be rejected without overwriting newer content.");
    const staleDelete = await storyLabDelete(request("DELETE", ownerToken.accessToken, { id, kind: "story", revision: 0 }));
    assert.equal(staleDelete.status, 409, "Stale DELETE must be rejected.");
    const afterStale = await storyLabGet(request("GET", ownerToken.accessToken));
    const afterStaleBody = await afterStale.json() as { stories: Array<{ id: string; title: string; revision: number }> };
    const retained = afterStaleBody.stories.find((story) => story.id === id);
    assert.deepEqual(retained && { title: retained.title, revision: retained.revision }, { title: fields.title, revision: 1 }, "Rejected stale edit changed the saved material.");

    const duplicate = await storyLabPut(request("PUT", ownerToken.accessToken, createPayload));
    if (duplicate.status !== 200) {
      failures.push(`Duplicate create replay returned HTTP ${duplicate.status} (${await errorCode(duplicate)}); expected an idempotent 200 replay.`);
    } else {
      const replay = await duplicate.json() as { id: string; revision: number };
      assert.deepEqual({ id: replay.id, revision: replay.revision }, { id, revision: 1 }, "Duplicate create replay returned a different material.");
    }

    const draftId = randomUUID();
    const draftPayload = {
      id: draftId,
      kind: "introduction" as const,
      revision: 0,
      fields: materialFieldsSchema.parse({
        title: "Career opening",
        rawNotes: "I am a pilot with extensive safety leadership experience across complex operations and strong mentoring results.",
        audience: "virtual",
        length: "medium",
      }),
    };
    let draftProviderCalls = 0;
    globalThis.fetch = async () => {
      draftProviderCalls++;
      return new Response(JSON.stringify({ id: "synthetic-story-lab-provider", output_text: JSON.stringify({ title: "Generated opening", background: "Pilot background", strength: "Safety leadership", proofPoint: "Mentoring result", roleInterest: "This role", transition: "I would welcome the conversation.", script: "I am a pilot focused on safety leadership." }), usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const draftOne = await draftPost(request("POST", ownerToken.accessToken, draftPayload));
    assert.equal(draftOne.status, 200, "Mocked introduction draft should succeed without a paid provider.");
    const draftOneBody = await draftOne.json() as { draftId: string; fields: { title: string } };
    const draftTwo = await draftPost(request("POST", ownerToken.accessToken, draftPayload));
    assert.equal(draftTwo.status, 200, "Identical draft replay should return the completed draft.");
    const draftTwoBody = await draftTwo.json() as { draftId: string; fields: { title: string } };
    assert.equal(draftProviderCalls, 1, "Identical draft replay started more than one provider request.");
    assert.deepEqual(draftTwoBody, draftOneBody, "Draft replay returned a different result.");
    const draftConflict = await draftPost(request("POST", ownerToken.accessToken, { ...draftPayload, fields: { ...draftPayload.fields, rawNotes: `${draftPayload.fields.rawNotes} changed` } }));
    assert.equal(draftConflict.status, 409, "Reusing a draft ID with changed notes must be rejected.");

    if (failures.length) throw new Error(failures.join("\n"));
    console.log("P6.2 Story Lab mobile API services passed: auth/ownership, validation, stale edits, manual no-provider saves, and draft replay/provider boundaries.");
  } finally {
    globalThis.fetch = originalFetch;
    await db.delete(interviewPreparationDrafts).where(eq(interviewPreparationDrafts.userId, ownerId));
    await db.delete(users).where(inArray(users.id, [ownerId, strangerId]));
    await (globalThis as typeof globalThis & { quesiqPool?: { end(): Promise<void> } }).quesiqPool?.end();
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
