import type { AiRunRecord } from "@/product/interview-types";
import { listAiRuns } from "@/server/ai-runs/ai-runs";

export type ContentStudioRunHistoryRecord = {
  cardCount?: number;
  completedAt?: string;
  errorMessage?: string;
  generationWarnings: string[];
  id: string;
  model: string;
  pipelineKey: "study_flashcards";
  providerRequestId?: string;
  startedAt: string;
  status: AiRunRecord["status"];
  storage: "ai_run_audit_only";
  templateKey?: string;
  totalTokens?: number;
  userEmail?: string;
};

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

function toContentStudioRunHistory(run: AiRunRecord): ContentStudioRunHistoryRecord {
  return {
    cardCount: numberOrUndefined(run.rawJson?.cardCount),
    completedAt: run.completedAt,
    errorMessage: run.errorMessage,
    generationWarnings: stringArray(run.rawJson?.generationWarnings),
    id: run.id,
    model: run.model,
    pipelineKey: "study_flashcards",
    providerRequestId: run.providerRequestId,
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

  return runs.filter(isStudyContentStudioRun).slice(0, limit).map(toContentStudioRunHistory);
}
