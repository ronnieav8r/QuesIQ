import type { AiRunRecord } from "@/product/interview-types";
import { listAiRuns } from "@/server/ai-runs/ai-runs";

export type ContentStudioRunHistoryRecord = {
  cardCount?: number;
  completedAt?: string;
  confidence?: number;
  errorMessage?: string;
  generationWarnings: string[];
  id: string;
  missingFields: string[];
  model: string;
  pipelineKey: "dpe_content" | "study_flashcards";
  providerRequestId?: string;
  readyToReview?: boolean;
  startedAt: string;
  status: AiRunRecord["status"];
  storage: "ai_run_audit_only";
  templateKey?: string;
  totalTokens?: number;
  userEmail?: string;
};

const DPE_CONTENT_DRAFT_OPERATION = "dpe_content_studio_draft";
const STUDY_FLASHCARD_DRAFT_OPERATION = "study_content_studio_flashcard_draft";

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberOrUndefined(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isStudyContentStudioRun(run: AiRunRecord) {
  return run.rawJson?.operation === STUDY_FLASHCARD_DRAFT_OPERATION;
}

function isDpeContentStudioRun(run: AiRunRecord) {
  return run.rawJson?.operation === DPE_CONTENT_DRAFT_OPERATION;
}

function isContentStudioRun(run: AiRunRecord) {
  return isStudyContentStudioRun(run) || isDpeContentStudioRun(run);
}

function toContentStudioRunHistory(run: AiRunRecord): ContentStudioRunHistoryRecord {
  const dpeRun = isDpeContentStudioRun(run);

  return {
    cardCount: numberOrUndefined(run.rawJson?.cardCount),
    completedAt: run.completedAt,
    confidence: numberOrUndefined(run.rawJson?.confidence),
    errorMessage: run.errorMessage,
    generationWarnings: stringArray(run.rawJson?.generationWarnings),
    id: run.id,
    missingFields: stringArray(run.rawJson?.missingFields),
    model: run.model,
    pipelineKey: dpeRun ? "dpe_content" : "study_flashcards",
    providerRequestId: run.providerRequestId,
    readyToReview:
      typeof run.rawJson?.readyToReview === "boolean" ? run.rawJson.readyToReview : undefined,
    startedAt: run.startedAt,
    status: run.status,
    storage: "ai_run_audit_only",
    templateKey:
      typeof run.rawJson?.templateKey === "string" ? run.rawJson.templateKey : undefined,
    totalTokens: run.totalTokens,
    userEmail: run.userEmail,
  };
}

export async function listContentStudioRunHistory(limit = 25) {
  const runs = await listAiRuns(200);

  return runs.filter(isContentStudioRun).slice(0, limit).map(toContentStudioRunHistory);
}
