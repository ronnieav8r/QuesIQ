import { and, desc, eq } from "drizzle-orm";

import type { InterviewContext, JobTargetRecord } from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { jobTargets, profiles } from "@/server/db/schema";

function defaultLabel(input: Pick<JobTargetRecord, "targetCompany" | "targetRole">) {
  return input.targetCompany
    ? `${input.targetRole} at ${input.targetCompany}`
    : input.targetRole;
}

function toRecord(row: typeof jobTargets.$inferSelect): JobTargetRecord {
  return {
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    jobDescription: row.jobDescription,
    label: row.label || defaultLabel(row),
    lastUsedAt: row.lastUsedAt?.toISOString(),
    targetCompany: row.targetCompany,
    targetRole: row.targetRole,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function parseJobTargetInput(value: unknown):
  | {
      jobDescription: string;
      label?: string;
      targetCompany: string;
      targetRole: string;
    }
  | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.targetRole !== "string" ||
    typeof candidate.targetCompany !== "string" ||
    typeof candidate.jobDescription !== "string"
  ) {
    return undefined;
  }

  return {
    jobDescription: candidate.jobDescription.trim(),
    label: typeof candidate.label === "string" ? candidate.label.trim() : undefined,
    targetCompany: candidate.targetCompany.trim(),
    targetRole: candidate.targetRole.trim(),
  };
}

export async function listJobTargets(userId: string): Promise<JobTargetRecord[]> {
  const rows = await getDb()
    .select()
    .from(jobTargets)
    .where(eq(jobTargets.userId, userId))
    .orderBy(desc(jobTargets.lastUsedAt), desc(jobTargets.updatedAt))
    .limit(50);

  return rows.map(toRecord);
}

export async function saveJobTarget(
  userId: string,
  input: {
    jobDescription: string;
    label?: string;
    targetCompany: string;
    targetRole: string;
  },
): Promise<JobTargetRecord> {
  const now = new Date();
  const targetRole = input.targetRole.trim();
  const targetCompany = input.targetCompany.trim();
  const values = {
    jobDescription: input.jobDescription.trim(),
    label: input.label?.trim() || defaultLabel({ targetCompany, targetRole }),
    targetCompany,
    targetRole,
    updatedAt: now,
    userId,
  };
  const [target] = await getDb()
    .insert(jobTargets)
    .values(values)
    .onConflictDoUpdate({
      set: values,
      target: [
        jobTargets.userId,
        jobTargets.targetRole,
        jobTargets.targetCompany,
      ],
    })
    .returning();

  return toRecord(target);
}

export async function updateJobTarget(
  userId: string,
  targetId: string,
  input: {
    jobDescription: string;
    label?: string;
    targetCompany: string;
    targetRole: string;
  },
): Promise<JobTargetRecord | undefined> {
  const now = new Date();
  const targetRole = input.targetRole.trim();
  const targetCompany = input.targetCompany.trim();
  const [target] = await getDb()
    .update(jobTargets)
    .set({
      jobDescription: input.jobDescription.trim(),
      label: input.label?.trim() || defaultLabel({ targetCompany, targetRole }),
      targetCompany,
      targetRole,
      updatedAt: now,
    })
    .where(and(eq(jobTargets.id, targetId), eq(jobTargets.userId, userId)))
    .returning();

  return target ? toRecord(target) : undefined;
}

export async function deleteJobTarget(userId: string, targetId: string): Promise<boolean> {
  await getDb()
    .update(profiles)
    .set({
      activeJobTargetId: null,
      updatedAt: new Date(),
    })
    .where(and(eq(profiles.userId, userId), eq(profiles.activeJobTargetId, targetId)));

  const [deleted] = await getDb()
    .delete(jobTargets)
    .where(and(eq(jobTargets.id, targetId), eq(jobTargets.userId, userId)))
    .returning({ id: jobTargets.id });

  return Boolean(deleted);
}

export async function setActiveJobTarget(
  userId: string,
  targetId: string,
): Promise<JobTargetRecord | undefined> {
  const [target] = await getDb()
    .select()
    .from(jobTargets)
    .where(and(eq(jobTargets.id, targetId), eq(jobTargets.userId, userId)))
    .limit(1);

  if (!target) {
    return undefined;
  }

  const now = new Date();

  await getDb()
    .insert(profiles)
    .values({
      activeJobTargetId: targetId,
      updatedAt: now,
      userId,
    })
    .onConflictDoUpdate({
      set: {
        activeJobTargetId: targetId,
        updatedAt: now,
      },
      target: profiles.userId,
    });

  return toRecord(target);
}

export async function saveJobTargetFromContext(
  userId: string,
  context: InterviewContext,
): Promise<JobTargetRecord | undefined> {
  if (!context.targetRole.trim()) {
    return undefined;
  }

  return saveJobTarget(userId, {
    jobDescription: context.jobDescription,
    targetCompany: context.targetCompany,
    targetRole: context.targetRole,
  });
}

export async function markJobTargetUsed(userId: string, targetId?: string) {
  if (!targetId) {
    return;
  }

  await getDb()
    .update(jobTargets)
    .set({
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(jobTargets.id, targetId), eq(jobTargets.userId, userId)));
}
