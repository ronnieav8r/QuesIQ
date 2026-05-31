import { and, desc, eq, gte, sql } from "drizzle-orm";

import type { ContentStudioPipelineKey } from "@/features/admin/content-studio-config";
import { getDb } from "@/server/db/client";
import { aiRuns, contentStudioRuns, users } from "@/server/db/schema";

export type ContentStudioRunStatus =
  | "approved_for_publish"
  | "archived"
  | "draft_ready"
  | "failed"
  | "needs_revision";

export type ContentStudioRunRecord = {
  adminUserEmail?: string;
  adminUserId?: string;
  aiRunId?: string;
  completedAt?: string;
  confidence?: number;
  createdAt: string;
  customInstructions?: string;
  draft: Record<string, unknown>;
  id: string;
  missingFields: string[];
  pipelineKey: ContentStudioPipelineKey;
  reviewerChecklist?: Record<string, unknown>;
  reviewerNotes?: string;
  reviewerSummary?: Record<string, unknown>;
  sourceMetadata: Record<string, unknown>;
  sourceTextSnapshot?: string;
  stage: string;
  status: ContentStudioRunStatus;
  storage: "content_studio_runs";
  templateKey: string;
  updatedAt: string;
  warnings: string[];
};

type CreateContentStudioRunInput = {
  adminUserId: string;
  aiRunId?: string;
  completedAt?: Date;
  customInstructions?: string;
  draft: Record<string, unknown>;
  pipelineKey: ContentStudioPipelineKey;
  sourceMetadata?: Record<string, unknown>;
  sourceText: string;
  stage?: string;
  status?: ContentStudioRunStatus;
  templateKey: string;
};

type UpdateContentStudioRunInput = {
  reviewerNotes?: string;
  status?: ContentStudioRunStatus;
};

const CONTENT_STUDIO_AI_OPERATIONS: Record<ContentStudioPipelineKey, string> = {
  dpe_content: "dpe_content_studio_draft",
  study_flashcards: "study_content_studio_flashcard_draft",
};
const MAX_SOURCE_SNAPSHOT_CHARS = 24_000;
const REVIEW_STATUSES: ContentStudioRunStatus[] = [
  "approved_for_publish",
  "archived",
  "draft_ready",
  "failed",
  "needs_revision",
];

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberOrUndefined(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function objectOrUndefined(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function isReviewStatus(value: unknown): value is ContentStudioRunStatus {
  return typeof value === "string" && REVIEW_STATUSES.includes(value as ContentStudioRunStatus);
}

function sourceSnapshot(sourceText: string) {
  const trimmed = sourceText.trim();

  return {
    snapshot: trimmed.slice(0, MAX_SOURCE_SNAPSHOT_CHARS),
    metadata: {
      originalLength: trimmed.length,
      snapshotLength: Math.min(trimmed.length, MAX_SOURCE_SNAPSHOT_CHARS),
      sourceTruncated: trimmed.length > MAX_SOURCE_SNAPSHOT_CHARS,
    },
  };
}

function averageCardConfidence(draft: Record<string, unknown>) {
  const cards = Array.isArray(draft.cards) ? draft.cards : [];
  const confidenceValues = cards
    .map((card) =>
      card && typeof card === "object"
        ? numberOrUndefined((card as Record<string, unknown>).confidence)
        : undefined,
    )
    .filter((value): value is number => value !== undefined);

  if (confidenceValues.length === 0) {
    return undefined;
  }

  return Number(
    (
      confidenceValues.reduce((sum, value) => sum + value, 0) /
      confidenceValues.length
    ).toFixed(2),
  );
}

function summarizeDraft(pipelineKey: ContentStudioPipelineKey, draft: Record<string, unknown>) {
  if (pipelineKey === "dpe_content") {
    const readiness = objectOrUndefined(draft.readiness);

    return {
      confidence: numberOrUndefined(draft.confidence),
      missingFields: stringArray(readiness?.missingFields),
      reviewerChecklist: readiness,
      reviewerSummary: {
        readyToReview:
          typeof readiness?.readyToReview === "boolean" ? readiness.readyToReview : undefined,
        sourceSummary: typeof draft.sourceSummary === "string" ? draft.sourceSummary : undefined,
      },
      warnings: stringArray(draft.warnings),
    };
  }

  const confidenceSummary = objectOrUndefined(draft.confidenceSummary);

  return {
    confidence:
      numberOrUndefined(confidenceSummary?.average) ?? averageCardConfidence(draft),
    missingFields: stringArray(draft.missingFields),
    reviewerChecklist: objectOrUndefined(draft.reviewChecklist),
    reviewerSummary: {
      cardCount: numberOrUndefined(draft.cardCount),
      sourceSummary: typeof draft.sourceSummary === "string" ? draft.sourceSummary : undefined,
      title: typeof draft.title === "string" ? draft.title : undefined,
    },
    warnings: stringArray(draft.generationWarnings),
  };
}

function toRecord(row: {
  adminUserEmail: string | null;
  adminUserId: string | null;
  aiRunId: string | null;
  completedAt: Date | null;
  confidence: number | null;
  createdAt: Date;
  customInstructions: string | null;
  draftPayload: Record<string, unknown>;
  id: string;
  missingFields: string[];
  pipelineKey: ContentStudioPipelineKey;
  reviewerChecklist: Record<string, unknown> | null;
  reviewerNotes: string | null;
  reviewerSummary: Record<string, unknown> | null;
  sourceMetadata: Record<string, unknown>;
  sourceTextSnapshot: string | null;
  stage: string;
  status: ContentStudioRunStatus;
  templateKey: string;
  updatedAt: Date;
  warnings: string[];
}): ContentStudioRunRecord {
  return {
    adminUserEmail: row.adminUserEmail ?? undefined,
    adminUserId: row.adminUserId ?? undefined,
    aiRunId: row.aiRunId ?? undefined,
    completedAt: row.completedAt?.toISOString(),
    confidence: row.confidence ?? undefined,
    createdAt: row.createdAt.toISOString(),
    customInstructions: row.customInstructions ?? undefined,
    draft: row.draftPayload,
    id: row.id,
    missingFields: row.missingFields,
    pipelineKey: row.pipelineKey,
    reviewerChecklist: row.reviewerChecklist ?? undefined,
    reviewerNotes: row.reviewerNotes ?? undefined,
    reviewerSummary: row.reviewerSummary ?? undefined,
    sourceMetadata: row.sourceMetadata,
    sourceTextSnapshot: row.sourceTextSnapshot ?? undefined,
    stage: row.stage,
    status: row.status,
    storage: "content_studio_runs",
    templateKey: row.templateKey,
    updatedAt: row.updatedAt.toISOString(),
    warnings: row.warnings,
  };
}

function runSelect() {
  return {
    adminUserEmail: users.email,
    adminUserId: contentStudioRuns.adminUserId,
    aiRunId: contentStudioRuns.aiRunId,
    completedAt: contentStudioRuns.completedAt,
    confidence: contentStudioRuns.confidence,
    createdAt: contentStudioRuns.createdAt,
    customInstructions: contentStudioRuns.customInstructions,
    draftPayload: contentStudioRuns.draftPayload,
    id: contentStudioRuns.id,
    missingFields: contentStudioRuns.missingFields,
    pipelineKey: contentStudioRuns.pipelineKey,
    reviewerChecklist: contentStudioRuns.reviewerChecklist,
    reviewerNotes: contentStudioRuns.reviewerNotes,
    reviewerSummary: contentStudioRuns.reviewerSummary,
    sourceMetadata: contentStudioRuns.sourceMetadata,
    sourceTextSnapshot: contentStudioRuns.sourceTextSnapshot,
    stage: contentStudioRuns.stage,
    status: contentStudioRuns.status,
    templateKey: contentStudioRuns.templateKey,
    updatedAt: contentStudioRuns.updatedAt,
    warnings: contentStudioRuns.warnings,
  };
}

export function parseContentStudioRunStatus(value: unknown) {
  return isReviewStatus(value) ? value : undefined;
}

export async function findLatestContentStudioAiRun(args: {
  since: Date;
  pipelineKey: ContentStudioPipelineKey;
  userId: string;
}) {
  const operation = CONTENT_STUDIO_AI_OPERATIONS[args.pipelineKey];
  const [run] = await getDb()
    .select({
      id: aiRuns.id,
      providerRequestId: aiRuns.providerRequestId,
    })
    .from(aiRuns)
    .where(
      and(
        eq(aiRuns.userId, args.userId),
        gte(aiRuns.createdAt, args.since),
        sql`${aiRuns.rawJson}->>'operation' = ${operation}`,
      ),
    )
    .orderBy(desc(aiRuns.createdAt))
    .limit(1);

  return run;
}

export async function createContentStudioRun(input: CreateContentStudioRunInput) {
  const now = new Date();
  const source = sourceSnapshot(input.sourceText);
  const draftSummary = summarizeDraft(input.pipelineKey, input.draft);
  const [row] = await getDb()
    .insert(contentStudioRuns)
    .values({
      adminUserId: input.adminUserId,
      aiRunId: input.aiRunId,
      completedAt: input.completedAt ?? now,
      confidence: draftSummary.confidence,
      customInstructions: input.customInstructions,
      draftPayload: input.draft,
      missingFields: draftSummary.missingFields,
      pipelineKey: input.pipelineKey,
      reviewerChecklist: draftSummary.reviewerChecklist,
      reviewerSummary: draftSummary.reviewerSummary,
      sourceMetadata: {
        ...source.metadata,
        ...(input.sourceMetadata ?? {}),
      },
      sourceTextSnapshot: source.snapshot,
      stage: input.stage ?? "review",
      status: input.status ?? "draft_ready",
      templateKey: input.templateKey,
      updatedAt: now,
      warnings: draftSummary.warnings,
    })
    .returning({
      id: contentStudioRuns.id,
    });

  const run = await getContentStudioRun(row.id);

  if (!run) {
    throw new Error("Content Studio run was created but could not be loaded.");
  }

  return run;
}

export async function getContentStudioRun(id: string) {
  const [row] = await getDb()
    .select(runSelect())
    .from(contentStudioRuns)
    .leftJoin(users, eq(users.id, contentStudioRuns.adminUserId))
    .where(eq(contentStudioRuns.id, id))
    .limit(1);

  return row ? toRecord(row) : undefined;
}

export async function listContentStudioRuns(limit = 25) {
  const rows = await getDb()
    .select(runSelect())
    .from(contentStudioRuns)
    .leftJoin(users, eq(users.id, contentStudioRuns.adminUserId))
    .orderBy(desc(contentStudioRuns.createdAt))
    .limit(limit);

  return rows.map(toRecord);
}

export async function updateContentStudioRunReview(
  id: string,
  input: UpdateContentStudioRunInput,
) {
  const values: {
    reviewerNotes?: string;
    status?: ContentStudioRunStatus;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (input.reviewerNotes !== undefined) {
    values.reviewerNotes = input.reviewerNotes;
  }

  if (input.status) {
    values.status = input.status;
  }

  const [updated] = await getDb()
    .update(contentStudioRuns)
    .set(values)
    .where(eq(contentStudioRuns.id, id))
    .returning({
      id: contentStudioRuns.id,
    });

  return updated ? getContentStudioRun(updated.id) : undefined;
}
