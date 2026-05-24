import { and, desc, eq, max } from "drizzle-orm";

import type {
  PromptConfigKey,
  PromptConfigRecord,
  PromptConfigTarget,
} from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { promptConfigs } from "@/server/db/schema";
import { isPromptConfigKey, promptConfigFallbacks } from "@/server/prompts/defaults";

type PromptConfigInput = {
  activate: boolean;
  instructions: string;
  key: PromptConfigKey;
  model: string;
  name: string;
  target: PromptConfigTarget;
  voice?: string;
};

function toPromptConfigRecord(
  row: typeof promptConfigs.$inferSelect,
): PromptConfigRecord {
  return {
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    instructions: row.instructions,
    key: row.key as PromptConfigKey,
    model: row.model,
    name: row.name,
    target: row.target,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
    voice: row.voice ?? undefined,
  };
}

function fallbackRecord(key: PromptConfigKey): PromptConfigRecord {
  const fallback = promptConfigFallbacks[key];
  const now = new Date(0).toISOString();

  return {
    ...fallback,
    createdAt: now,
    id: `${key}:fallback`,
    updatedAt: now,
  };
}

export async function listPromptConfigs(): Promise<PromptConfigRecord[]> {
  const rows = await getDb()
    .select()
    .from(promptConfigs)
    .orderBy(promptConfigs.key, desc(promptConfigs.version));

  return rows.map(toPromptConfigRecord);
}

export async function getActivePromptConfig(
  key: PromptConfigKey,
): Promise<PromptConfigRecord> {
  const [row] = await getDb()
    .select()
    .from(promptConfigs)
    .where(and(eq(promptConfigs.key, key), eq(promptConfigs.active, true)))
    .orderBy(desc(promptConfigs.version))
    .limit(1);

  if (!row) {
    return fallbackRecord(key);
  }

  return toPromptConfigRecord(row);
}

export async function createPromptConfigVersion(
  input: PromptConfigInput,
  userId: string,
): Promise<PromptConfigRecord> {
  if (!isPromptConfigKey(input.key)) {
    throw new Error("Prompt config key is not supported.");
  }

  if (!input.instructions.trim() || !input.model.trim() || !input.name.trim()) {
    throw new Error("Prompt name, model, and instructions are required.");
  }

  const now = new Date();
  const [versionRow] = await getDb()
    .select({ latestVersion: max(promptConfigs.version) })
    .from(promptConfigs)
    .where(eq(promptConfigs.key, input.key));
  const version = Number(versionRow?.latestVersion ?? 0) + 1;

  if (input.activate) {
    await getDb()
      .update(promptConfigs)
      .set({ active: false, updatedAt: now })
      .where(eq(promptConfigs.key, input.key));
  }

  const [row] = await getDb()
    .insert(promptConfigs)
    .values({
      active: input.activate,
      createdByUserId: userId,
      instructions: input.instructions.trim(),
      key: input.key,
      model: input.model.trim(),
      name: input.name.trim(),
      target: input.target,
      updatedAt: now,
      version,
      voice: input.voice?.trim() || null,
    })
    .returning();

  return toPromptConfigRecord(row);
}

export async function activatePromptConfig(
  id: string,
  userId: string,
): Promise<PromptConfigRecord | undefined> {
  const now = new Date();
  const [target] = await getDb()
    .select()
    .from(promptConfigs)
    .where(eq(promptConfigs.id, id))
    .limit(1);

  if (!target) {
    return undefined;
  }

  await getDb()
    .update(promptConfigs)
    .set({ active: false, updatedAt: now })
    .where(eq(promptConfigs.key, target.key));

  const [row] = await getDb()
    .update(promptConfigs)
    .set({
      active: true,
      createdByUserId: userId,
      updatedAt: now,
    })
    .where(eq(promptConfigs.id, id))
    .returning();

  return toPromptConfigRecord(row);
}
