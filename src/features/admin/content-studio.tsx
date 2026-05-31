"use client";

import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileText,
  History,
  Images,
  Play,
  ShieldCheck,
  Table2,
  UploadCloud,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import {
  type ContentStudioPipelineKey,
  contentStudioPipelines,
  contentStudioStages,
  contentStudioTemplatesByPipeline,
} from "@/features/admin/content-studio-config";
import {
  type DpeTargetTrackKey,
  dpeTargetTracks,
  findDpeTargetTrack,
  parseDpeTargetTrackKey,
} from "@/features/admin/dpe-target-tracks";

type StudyGeneratedFlashcardDraft = {
  answer: string;
  confidence: number;
  hint?: string;
  level: "advanced" | "beginner" | "intermediate";
  question: string;
  sourceNotes?: string;
};

type StudyGeneratedDeckDraft = {
  cards: StudyGeneratedFlashcardDraft[];
  cardCount?: number;
  confidenceSummary?: {
    average: number;
    highConfidenceCount: number;
    lowConfidenceCardIndexes: number[];
    lowConfidenceCount: number;
  };
  description: string;
  generationMode: "ai" | "mock";
  generationWarnings: string[];
  missingFields?: string[];
  promptInstructions?: string;
  reviewChecklist?: Record<string, boolean>;
  sourceSummary: string;
  subject?: string;
  tags: string[];
  title: string;
};

type DpeContentStudioDraft = {
  acs: {
    area?: string;
    elementType?: string;
    reference?: string;
    task?: string;
    title?: string;
  };
  answerKey: {
    acceptableVariations: string[];
    commonMisses: string[];
    correctAnswerElements: string[];
    notes?: string;
    sourceReferences: string[];
    status: "draft";
  };
  certificate: {
    code?: string;
    id?: string;
    title?: string;
  };
  confidence: number;
  generation: {
    mode: "ai" | "fallback";
    model: string | null;
    saved: false;
  };
  oralQuestion: {
    acsElementType?: string;
    primarySubject?: string;
    questionMode: "oral";
    questionText: string;
  };
  readiness: {
    hasAcsReference: boolean;
    hasAcsTask: boolean;
    hasAnswerKey: boolean;
    hasCertificate: boolean;
    hasQuestion: boolean;
    hasRubric: boolean;
    missingFields: string[];
    readyToReview: boolean;
  };
  rubric: {
    checkrideReadiness: string;
    communication: string;
    knowledge: string;
    riskManagement: string;
    scenarioJudgment: string;
    scoringNotes?: string;
    status: "draft";
  };
  sourceSummary: string;
  warnings: string[];
};

type DpeDraftContext = {
  acs: {
    area: string;
    elementType: string;
    reference: string;
    task: string;
    title: string;
  };
  certificate: {
    code: string;
    id: string;
    title: string;
  };
  targetTrackKey: DpeTargetTrackKey | "";
};

type ContentStudioRunStatus =
  | "approved_for_publish"
  | "archived"
  | "draft_ready"
  | "failed"
  | "needs_revision";

type BaseContentStudioRun = {
  adminUserEmail?: string;
  aiRunId?: string;
  completedAt?: string;
  confidence?: number;
  createdAt: string;
  customInstructions?: string;
  id: string;
  missingFields: string[];
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

type StudyDraftRun = BaseContentStudioRun & {
  draft: StudyGeneratedDeckDraft;
  pipelineKey: "study_flashcards";
};

type DpeDraftRun = BaseContentStudioRun & {
  draft: DpeContentStudioDraft;
  pipelineKey: "dpe_content";
};

type ContentStudioDraftRun = DpeDraftRun | StudyDraftRun;

type RunsResponse = {
  run?: ContentStudioDraftRun;
  runs?: ContentStudioDraftRun[];
  storage?: {
    detail: string;
    durableReviewState: boolean;
  };
  error?: string;
};

type GenerateStatus = "draft_ready" | "generating" | "idle";
type SaveReviewStatus = "idle" | "saving" | "saved";

type SourcePackVisualStatus =
  | "cropped_candidate"
  | "cropped_reviewed"
  | "metadata_only"
  | "rendered_page";

type SourcePackKeepRecommendation = "keep" | "review" | "skip";
type SourcePackReviewDecision =
  | "accepted"
  | "candidate"
  | "keep"
  | "needs_edit"
  | "reject";
type SourcePackReviewTab = "chunks" | "figures" | "tables";

type SourcePackReviewBucket = "accepted" | "candidate" | "needs_edit" | "rejected";

type SourcePackManifest = {
  chunkCount: number;
  createdAt: string;
  figureCount: number;
  id: string;
  sourceCount: number;
  sourceIds: string[];
  tableCount: number;
  title: string;
};

type SourcePackChunkCandidate = {
  anchor: string;
  chunkId: string;
  contextBefore?: string;
  excerpt: string;
  page: number;
  relatedFigureIds: string[];
  relatedTableIds: string[];
  reviewDecision: SourcePackReviewDecision;
  reviewNotes?: string;
  sourceId: string;
  sourceTitle: string;
  subjects: string[];
  tags: string[];
  useCases: string[];
};

type SourcePackReviewDecisionRecord = {
  candidateId: string;
  candidateType: "chunk" | "figure" | "table";
  reviewBucket: SourcePackReviewBucket;
  reviewDecision: SourcePackReviewDecision;
  reviewerNotes?: string;
  reviewedAssetIds: string[];
  sourceAnchor: string;
  sourceId: string;
};

type SourcePackReviewRun = {
  decisions: SourcePackReviewDecisionRecord[];
  id: string;
  manifestId: string;
  reviewCounts: Record<SourcePackReviewBucket, number>;
  stage: "admin_review_scaffold";
};

type SourcePackVisualReviewCandidate = {
  assetPath?: string;
  bbox?: [number, number, number, number];
  caption?: string;
  figureLabel?: string;
  id: string;
  instructionalValue?: string;
  keepRecommendation: SourcePackKeepRecommendation;
  page: number;
  pageAssetPath?: string;
  relatedChunkIds: string[];
  reviewDecision: SourcePackReviewDecision;
  reviewAssetPath?: string;
  reviewNotes?: string;
  reviewStatus: SourcePackVisualStatus;
  sourceId: string;
  sourceTitle: string;
  sourceExcerpt?: string;
  subject?: string;
  subtopics?: string[];
  tableLabel?: string;
  topic?: string;
  type: "figure" | "table";
  useCases?: string[];
};

const MIN_SOURCE_CHARS = 40;

const sourcePackManifest: SourcePackManifest = {
  chunkCount: 3,
  createdAt: "2026-05-31T10:00:00.000Z",
  figureCount: 1,
  id: "demo-source-pack-contract",
  sourceCount: 2,
  sourceIds: ["source-pack-guide", "dpe-reference-pack"],
  tableCount: 2,
  title: "Source-pack review contract demo",
};

const sourcePackChunkCandidates: SourcePackChunkCandidate[] = [
  {
    anchor: "source-pack-guide#page=14&chunk=chunk-source-pack-layout",
    chunkId: "chunk-source-pack-layout",
    contextBefore: "manifest.json declares the source set and stable source ids.",
    excerpt:
      "Source packs preserve page-level provenance and stable chunk links so generated content can be traced back during review.",
    page: 14,
    relatedFigureIds: ["fig-source-pack-flow"],
    relatedTableIds: [],
    reviewDecision: "accepted",
    reviewNotes: "Good source-pack overview candidate. Keep as review context, not product content.",
    sourceId: "source-pack-guide",
    sourceTitle: "Source Pack Implementation Guide",
    subjects: ["Admin Content Studio"],
    tags: ["manifest", "chunks", "provenance"],
    useCases: ["review orientation", "source QA"],
  },
  {
    anchor: "source-pack-guide#page=18&chunk=chunk-visual-jsonl-schema",
    chunkId: "chunk-visual-jsonl-schema",
    excerpt:
      "Figures and tables may be metadata-only at first, then upgraded to rendered-page or cropped review assets as tooling matures.",
    page: 18,
    relatedFigureIds: [],
    relatedTableIds: ["tbl-visual-schema"],
    reviewDecision: "needs_edit",
    reviewNotes: "Needs schema confirmation from manager-owned source-scrubber output.",
    sourceId: "source-pack-guide",
    sourceTitle: "Source Pack Implementation Guide",
    subjects: ["Admin Content Studio"],
    tags: ["figures.jsonl", "tables.jsonl", "review-state"],
    useCases: ["API contract", "review model"],
  },
  {
    anchor: "dpe-reference-pack#page=27&chunk=chunk-dpe-acs-example",
    chunkId: "chunk-dpe-acs-example",
    contextBefore: "The table is useful only if every row keeps row-level evidence.",
    excerpt:
      "Tables should not become product content automatically; reviewers need row-level source confidence before generation.",
    page: 27,
    relatedFigureIds: [],
    relatedTableIds: ["tbl-dpe-readiness-example"],
    reviewDecision: "candidate",
    reviewNotes: "Keep in Admin review queue only. Do not import into DPE runtime.",
    sourceId: "dpe-reference-pack",
    sourceTitle: "DPE Source Reference Pack",
    subjects: ["DPE"],
    tags: ["ACS", "evidence", "review-only"],
    useCases: ["DPE source review"],
  },
];

const sourcePackVisualCandidates: SourcePackVisualReviewCandidate[] = [
  {
    bbox: [0.18, 0.24, 0.74, 0.52],
    caption:
      "System diagram showing how source pages, chunks, figures, and tables link through stable ids.",
    figureLabel: "Figure 2",
    id: "fig-source-pack-flow",
    instructionalValue: "Good orientation visual for an admin reviewer or source-pack author.",
    keepRecommendation: "keep",
    page: 14,
    pageAssetPath: "pages/source-pack-guide-page-014.png",
    relatedChunkIds: ["chunk-source-pack-layout", "chunk-manifest-contract"],
    reviewDecision: "accepted",
    reviewAssetPath: "figures/fig-source-pack-flow.review.png",
    reviewNotes: "Needs cropped preview when renderer is available.",
    reviewStatus: "rendered_page",
    sourceExcerpt:
      "Source packs preserve page-level provenance and stable chunk links so generated content can be traced back during review.",
    sourceId: "source-pack-guide",
    sourceTitle: "Source Pack Implementation Guide",
    subject: "Admin Content Studio",
    subtopics: ["source packs", "provenance", "visual review"],
    topic: "Reusable ingestion contracts",
    type: "figure",
    useCases: ["review orientation", "content QA"],
  },
  {
    bbox: [0.09, 0.18, 0.86, 0.64],
    caption:
      "Matrix of figure and table fields including review status, recommendation, linked chunks, and preview asset paths.",
    id: "tbl-visual-schema",
    instructionalValue: "Useful as a field checklist before enabling durable source-pack loading.",
    keepRecommendation: "review",
    page: 18,
    relatedChunkIds: ["chunk-visual-jsonl-schema"],
    reviewDecision: "needs_edit",
    reviewNotes: "Confirm field names with manager ingestion output before making this editable.",
    reviewStatus: "metadata_only",
    sourceExcerpt:
      "Figures and tables may be metadata-only at first, then upgraded to rendered-page or cropped review assets as tooling matures.",
    sourceId: "source-pack-guide",
    sourceTitle: "Source Pack Implementation Guide",
    subject: "Admin Content Studio",
    subtopics: ["figures.jsonl", "tables.jsonl", "review state"],
    tableLabel: "Table 1",
    topic: "Visual metadata schema",
    type: "table",
    useCases: ["schema review", "API contract"],
  },
  {
    assetPath: "tables/table-dpe-example.csv",
    bbox: [0.12, 0.31, 0.78, 0.43],
    caption:
      "Example oral exam readiness table with ACS task, source reference, and reviewer keep decision.",
    id: "tbl-dpe-readiness-example",
    instructionalValue:
      "Likely useful for DPE content QA if the table is cleanly cropped and source-linked.",
    keepRecommendation: "skip",
    page: 27,
    pageAssetPath: "pages/dpe-reference-page-027.png",
    relatedChunkIds: ["chunk-dpe-acs-example", "chunk-dpe-review-evidence"],
    reviewDecision: "reject",
    reviewNotes: "Skip unless the source pack can link each row back to usable DPE content chunks.",
    reviewStatus: "cropped_candidate",
    sourceExcerpt:
      "Tables should not become product content automatically; reviewers need row-level source confidence before generation.",
    sourceId: "dpe-reference-pack",
    sourceTitle: "DPE Source Reference Pack",
    subject: "DPE",
    subtopics: ["ACS", "review readiness"],
    tableLabel: "Table 4",
    topic: "Checkride content QA",
    type: "table",
    useCases: ["DPE source review"],
  },
];

const emptyDpeContext: DpeDraftContext = {
  acs: {
    area: "",
    elementType: "",
    reference: "",
    task: "",
    title: "",
  },
  certificate: {
    code: "",
    id: "",
    title: "",
  },
  targetTrackKey: "",
};

function formatDate(value?: string) {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function confidenceLabel(value: number) {
  return `${Math.round(value * 100)}% generation confidence`;
}

function pipelineHistoryLabel(pipelineKey: ContentStudioDraftRun["pipelineKey"]) {
  return pipelineKey === "dpe_content" ? "DPE content draft" : "Study flashcard draft";
}

function statusLabel(status: ContentStudioRunStatus) {
  const labels: Record<ContentStudioRunStatus, string> = {
    approved_for_publish: "Approved for publish review",
    archived: "Archived",
    draft_ready: "Draft ready",
    failed: "Failed",
    needs_revision: "Needs revision",
  };

  return labels[status];
}

function cardCount(run: ContentStudioDraftRun) {
  return run.pipelineKey === "study_flashcards"
    ? run.draft.cardCount ?? run.draft.cards.length
    : undefined;
}

function runWarningText(run: ContentStudioDraftRun) {
  return run.warnings.length > 0 ? run.warnings.join(" ") : undefined;
}

function runTrackKey(run: ContentStudioDraftRun) {
  if (run.pipelineKey !== "dpe_content") {
    return undefined;
  }

  return parseDpeTargetTrackKey(run.sourceMetadata?.dpeTrackKey);
}

function runTrackLabel(run: ContentStudioDraftRun) {
  if (run.pipelineKey !== "dpe_content") {
    return undefined;
  }

  const explicitLabel =
    typeof run.sourceMetadata?.dpeTrackLabel === "string"
      ? run.sourceMetadata.dpeTrackLabel
      : undefined;
  if (explicitLabel) {
    return explicitLabel;
  }

  const track = findDpeTargetTrack(runTrackKey(run));
  return track?.label;
}

function stringOrEmpty(value: unknown) {
  return typeof value === "string" ? value : "";
}

function dpeContextFromRun(run: ContentStudioDraftRun): DpeDraftContext {
  if (run.pipelineKey !== "dpe_content") {
    return emptyDpeContext;
  }

  const metadataContext =
    run.sourceMetadata?.dpeContext &&
    typeof run.sourceMetadata.dpeContext === "object" &&
    !Array.isArray(run.sourceMetadata.dpeContext)
      ? (run.sourceMetadata.dpeContext as {
          acs?: Record<string, unknown>;
          certificate?: Record<string, unknown>;
          targetTrackKey?: unknown;
        })
      : undefined;
  const trackKey =
    parseDpeTargetTrackKey(metadataContext?.targetTrackKey) ??
    parseDpeTargetTrackKey(run.sourceMetadata?.dpeTrackKey) ??
    "";

  return {
    acs: {
      area: stringOrEmpty(metadataContext?.acs?.area ?? run.draft.acs.area),
      elementType: stringOrEmpty(
        metadataContext?.acs?.elementType ?? run.draft.acs.elementType,
      ),
      reference: stringOrEmpty(
        metadataContext?.acs?.reference ?? run.draft.acs.reference,
      ),
      task: stringOrEmpty(metadataContext?.acs?.task ?? run.draft.acs.task),
      title: stringOrEmpty(metadataContext?.acs?.title ?? run.draft.acs.title),
    },
    certificate: {
      code: stringOrEmpty(
        metadataContext?.certificate?.code ?? run.draft.certificate.code,
      ),
      id: stringOrEmpty(metadataContext?.certificate?.id ?? run.draft.certificate.id),
      title: stringOrEmpty(
        metadataContext?.certificate?.title ?? run.draft.certificate.title,
      ),
    },
    targetTrackKey: trackKey,
  };
}

function dpeContextFromSearchParams(params: URLSearchParams): DpeDraftContext {
  const trackKey = parseDpeTargetTrackKey(params.get("dpeTrackKey")) ?? "";
  const track = trackKey ? findDpeTargetTrack(trackKey) : undefined;

  return {
    acs: {
      area: params.get("acsArea") ?? "",
      elementType: params.get("acsElementType") ?? "",
      reference: params.get("acsReference") ?? "",
      task: params.get("acsTask") ?? "",
      title: params.get("acsTitle") ?? "",
    },
    certificate: {
      code: params.get("certificateCode") ?? track?.defaultCertificate.code ?? "",
      id: params.get("certificateId") ?? track?.defaultCertificate.id ?? "",
      title: params.get("certificateTitle") ?? track?.defaultCertificate.title ?? "",
    },
    targetTrackKey: trackKey,
  };
}

function hasDpeCertificateContext(context: DpeDraftContext) {
  return Boolean(
    context.certificate.code.trim() ||
      context.certificate.id.trim() ||
      context.certificate.title.trim(),
  );
}

function initialContentStudioUrlState() {
  if (typeof window === "undefined") {
    return {
      dpeContext: emptyDpeContext,
      pipelineKey: "study_flashcards" as ContentStudioPipelineKey,
      selectedTemplate: contentStudioTemplatesByPipeline.study_flashcards[0].value,
      sourceText: "",
    };
  }

  const params = new URLSearchParams(window.location.search);

  if (params.get("pipeline") !== "dpe_content") {
    return {
      dpeContext: emptyDpeContext,
      pipelineKey: "study_flashcards" as ContentStudioPipelineKey,
      selectedTemplate: contentStudioTemplatesByPipeline.study_flashcards[0].value,
      sourceText: "",
    };
  }

  return {
    dpeContext: dpeContextFromSearchParams(params),
    pipelineKey: "dpe_content" as ContentStudioPipelineKey,
    selectedTemplate: contentStudioTemplatesByPipeline.dpe_content[0].value,
    sourceText: params.get("sourceText") ?? "",
  };
}

export function ContentStudio() {
  const [urlState] = useState(initialContentStudioUrlState);
  const [pipelineKey, setPipelineKey] =
    useState<ContentStudioPipelineKey>(urlState.pipelineKey);
  const [selectedTemplate, setSelectedTemplate] = useState(urlState.selectedTemplate);
  const [sourceText, setSourceText] = useState(urlState.sourceText);
  const [customInstructions, setCustomInstructions] = useState("");
  const [dpeContext, setDpeContext] = useState<DpeDraftContext>(urlState.dpeContext);
  const [status, setStatus] = useState<GenerateStatus>("idle");
  const [error, setError] = useState<string>();
  const [draftRun, setDraftRun] = useState<ContentStudioDraftRun>();
  const [runHistory, setRunHistory] = useState<ContentStudioDraftRun[]>([]);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [reviewStatus, setReviewStatus] =
    useState<ContentStudioRunStatus>("draft_ready");
  const [reviewSaveStatus, setReviewSaveStatus] =
    useState<SaveReviewStatus>("idle");
  const [storageDetail, setStorageDetail] = useState<string>();

  const pipeline = useMemo(
    () => contentStudioPipelines.find((option) => option.key === pipelineKey) ?? contentStudioPipelines[0],
    [pipelineKey],
  );
  const templates = contentStudioTemplatesByPipeline[pipelineKey];
  const selectedTemplateDetail = templates.find(
    (template) => template.value === selectedTemplate,
  );
  const canGenerateDraft =
    status !== "generating" &&
    sourceText.trim().length >= MIN_SOURCE_CHARS &&
    (pipelineKey === "study_flashcards" || hasDpeCertificateContext(dpeContext));

  useEffect(() => {
    let cancelled = false;

    async function loadRuns() {
      try {
        const response = await fetch("/api/admin/content-studio/runs", {
          cache: "no-store",
        });
        const body = (await response.json()) as RunsResponse;

        if (cancelled) {
          return;
        }

        if (response.ok) {
          setRunHistory(body.runs ?? []);
          setStorageDetail(body.storage?.detail);
        }
      } catch {
        if (!cancelled) {
          setStorageDetail("Content Studio run history is unavailable right now.");
        }
      }
    }

    void loadRuns();

    return () => {
      cancelled = true;
    };
  }, []);

  function handlePipelineChange(nextPipeline: ContentStudioPipelineKey) {
    setPipelineKey(nextPipeline);
    setSelectedTemplate(contentStudioTemplatesByPipeline[nextPipeline][0].value);
    if (nextPipeline !== "dpe_content") {
      setDpeContext(emptyDpeContext);
    }
    setError(undefined);
  }

  function updateDpeContext(group: "acs" | "certificate", key: string, value: string) {
    setDpeContext((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [key]: value,
      },
    }));
  }

  function selectDraftRun(run: ContentStudioDraftRun) {
    setDraftRun(run);
    setDpeContext(dpeContextFromRun(run));
    setReviewerNotes(run.reviewerNotes ?? "");
    setReviewStatus(run.status);
    setReviewSaveStatus("idle");
  }

  function handleDpeTrackChange(trackKey: DpeTargetTrackKey | "") {
    if (!trackKey) {
      setDpeContext((current) => ({
        ...current,
        targetTrackKey: "",
      }));
      return;
    }

    const track = findDpeTargetTrack(trackKey);
    if (!track) {
      return;
    }

    setDpeContext((current) => ({
      ...current,
      certificate: {
        code: track.defaultCertificate.code,
        id: track.defaultCertificate.id,
        title: track.defaultCertificate.title,
      },
      targetTrackKey: track.key,
    }));
  }

  function upsertRunHistory(run: ContentStudioDraftRun) {
    setRunHistory((current) => [
      run,
      ...current.filter((candidate) => candidate.id !== run.id),
    ]);
  }

  async function handleOpenRun(runId: string) {
    setError(undefined);

    try {
      const response = await fetch(
        `/api/admin/content-studio/runs/${encodeURIComponent(runId)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as RunsResponse;

      if (!response.ok || !body.run) {
        throw new Error(body.error || "Content Studio run could not be opened.");
      }

      selectDraftRun(body.run);
      setPipelineKey(body.run.pipelineKey);
      setSelectedTemplate(body.run.templateKey);
      setSourceText(body.run.sourceTextSnapshot ?? "");
      setCustomInstructions(body.run.customInstructions ?? "");
      setStatus("draft_ready");
      upsertRunHistory(body.run);
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "Content Studio run could not be opened.",
      );
    }
  }

  async function handleSaveReview() {
    if (!draftRun) {
      return;
    }

    setReviewSaveStatus("saving");
    setError(undefined);

    try {
      const response = await fetch(
        `/api/admin/content-studio/runs/${encodeURIComponent(draftRun.id)}`,
        {
          body: JSON.stringify({
            reviewerNotes,
            status: reviewStatus,
          }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        },
      );
      const body = (await response.json()) as RunsResponse;

      if (!response.ok || !body.run) {
        throw new Error(body.error || "Content Studio review state could not be saved.");
      }

      setDraftRun(body.run);
      setReviewerNotes(body.run.reviewerNotes ?? "");
      setReviewStatus(body.run.status);
      upsertRunHistory(body.run);
      setReviewSaveStatus("saved");
    } catch (saveError) {
      setReviewSaveStatus("idle");
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Content Studio review state could not be saved.",
      );
    }
  }

  async function handleGenerateDraft() {
    if (!canGenerateDraft) {
      return;
    }

    setStatus("generating");
    setError(undefined);

    try {
      const response = await fetch("/api/admin/content-studio/runs", {
        body: JSON.stringify({
          customInstructions,
          dpeContext,
          pipelineKey,
          sourceText,
          templateKey: selectedTemplate,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as RunsResponse;

      if (!response.ok || !body.run) {
        throw new Error(body.error || "Content Studio draft generation failed.");
      }

      selectDraftRun(body.run);
      setRunHistory(body.runs ?? []);
      setStorageDetail(body.storage?.detail);
      setStatus("draft_ready");
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Content Studio draft generation failed.",
      );
      setStatus("idle");
    }
  }

  return (
    <section className="ai-runs-panel" aria-labelledby="content-studio-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Shared Admin</p>
          <h2 id="content-studio-title">Content Studio</h2>
          <p>
            Stage source intake, generation, verification, review, and future publishing for
            QuesIQ content pipelines.
          </p>
        </div>
      </div>

      <div className="study-stat-strip" aria-label="Content Studio scope">
        <div className="study-stat-chip">
          <strong>2</strong>
          <span>Priority pipelines</span>
        </div>
        <div className="study-stat-chip">
          <strong>5</strong>
          <span>Controlled stages</span>
        </div>
        <div className="study-stat-chip highlight">
          <strong>Separate</strong>
          <span>Generate and verify</span>
        </div>
      </div>

      <div className="admin-layout component-admin-layout">
        <aside className="prompt-version-list" aria-label="Content pipelines">
          <section>
            <h3>Pipeline</h3>
            {contentStudioPipelines.map((option) => (
              <button
                className={pipelineKey === option.key ? "active" : undefined}
                key={option.key}
                onClick={() => handlePipelineChange(option.key)}
                type="button"
              >
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </section>

          <section>
            <h3>Target artifact</h3>
            <p>{pipeline.targetArtifact}</p>
          </section>
        </aside>

        <div className="prompt-editor">
          <div className="section-head">
            <div>
              <h2>{pipeline.label}</h2>
              <span>{pipeline.sourceHint}</span>
            </div>
            <span>Draft generation ready</span>
          </div>

          <div className="field-grid">
            <label>
              <span>Source intake</span>
              <textarea
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="Paste source text, notes, outlines, CSV rows, ACS excerpts, or source links for the admin intake queue."
                value={sourceText}
              />
            </label>

            <label>
              <span>Reusable prompt/template</span>
              <select
                onChange={(event) => setSelectedTemplate(event.target.value)}
                value={selectedTemplate}
              >
                {templates.map((template) => (
                  <option key={template.value} value={template.value}>
                    {template.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="runtime-context-panel">
              <strong>Template intent</strong>
              <p>{selectedTemplateDetail?.description}</p>
            </div>

            {pipelineKey === "dpe_content" && (
              <DpeContextFields
                context={dpeContext}
                onChange={updateDpeContext}
                onTrackChange={handleDpeTrackChange}
              />
            )}

            <label>
              <span>Custom instructions</span>
              <textarea
                onChange={(event) => setCustomInstructions(event.target.value)}
                placeholder="Add product-specific constraints, source handling notes, tone requirements, verification thresholds, or reviewer instructions."
                value={customInstructions}
              />
            </label>
          </div>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <div className="component-tabs" aria-label="Content Studio actions">
            <button disabled type="button">
              <UploadCloud size={18} />
              Scrub source
            </button>
            <button
              disabled={!canGenerateDraft}
              onClick={handleGenerateDraft}
              type="button"
            >
              <Play size={18} />
              {status === "generating" ? "Generating" : "Generate draft"}
            </button>
            <button disabled type="button">
              <ShieldCheck size={18} />
              Verify draft
            </button>
            <button disabled type="button">
              <CheckCircle2 size={18} />
              Publish
            </button>
          </div>

          {pipelineKey === "dpe_content" && (
            <div className="form-note">
              DPE generation returns a draft for review only. It does not write
              questions, answer keys, rubrics, Official status, or Verified state.
            </div>
          )}
        </div>
      </div>

      {draftRun && (
        <>
          <ReviewStatePanel
            onNotesChange={setReviewerNotes}
            onSave={handleSaveReview}
            onStatusChange={setReviewStatus}
            reviewerNotes={reviewerNotes}
            run={draftRun}
            saveStatus={reviewSaveStatus}
            status={reviewStatus}
          />
          <DraftReviewPanel run={draftRun} />
        </>
      )}

      <SourcePackReviewScaffold
        chunks={sourcePackChunkCandidates}
        manifest={sourcePackManifest}
        visualCandidates={sourcePackVisualCandidates}
      />

      <section className="prompt-version-list" aria-labelledby="content-stages-title">
        <div className="section-head">
          <div>
            <h3 id="content-stages-title">Stage framing</h3>
            <p>Generation creates draft content. Verification is a separate quality gate.</p>
          </div>
        </div>

        <div className="study-stat-strip" aria-label="Content Studio stages">
          {contentStudioStages.map((stage, index) => (
            <div className="study-stat-chip" key={stage.label}>
              <strong>
                {index + 1}. {stage.label}
              </strong>
              <span>{stage.detail}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="prompt-version-list" aria-labelledby="content-history-title">
        <div className="section-head">
          <div>
            <h3 id="content-history-title">Run history</h3>
            <p>
              {storageDetail ??
                "AI-backed Content Studio draft runs appear here when durable AI usage storage is available."}
            </p>
          </div>
          <History size={20} aria-hidden="true" />
        </div>

        {runHistory.length > 0 ? (
          <div className="ai-runs-list">
            {runHistory.map((run) => (
              <article className="runtime-context-panel" key={run.id}>
                <div className="section-head">
                  <div>
                    <strong>{pipelineHistoryLabel(run.pipelineKey)}</strong>
                    <p>{formatDate(run.completedAt ?? run.createdAt)}</p>
                  </div>
                  <span>{statusLabel(run.status)}</span>
                </div>
                <div className="question-meta">
                  <span className="pill">{run.templateKey}</span>
                  {run.pipelineKey === "study_flashcards" && (
                    <span className="pill">{cardCount(run) ?? 0} cards</span>
                  )}
                  {run.pipelineKey === "dpe_content" && (
                    <>
                      {runTrackLabel(run) && <span className="pill">{runTrackLabel(run)}</span>}
                      <span className="pill">
                        {run.draft.readiness.readyToReview ? "ready to review" : "needs review"}
                      </span>
                      <span className="pill">
                        {run.confidence !== undefined
                          ? confidenceLabel(run.confidence)
                          : "confidence unavailable"}
                      </span>
                      <span className="pill">{run.missingFields.length} missing fields</span>
                    </>
                  )}
                  <span className="pill">{run.storage.replaceAll("_", " ")}</span>
                  {run.aiRunId && <span className="pill">AI run linked</span>}
                </div>
                {run.reviewerNotes && <p>Reviewer notes: {run.reviewerNotes}</p>}
                {runWarningText(run) && <p>{runWarningText(run)}</p>}
                <button onClick={() => void handleOpenRun(run.id)} type="button">
                  Reopen run
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="runtime-context-panel">
            <FileText size={18} aria-hidden="true" />
            <p>No durable Content Studio AI runs yet.</p>
          </div>
        )}
      </section>
    </section>
  );
}

function visualStatusLabel(status: SourcePackVisualStatus) {
  const labels: Record<SourcePackVisualStatus, string> = {
    cropped_candidate: "Cropped candidate",
    cropped_reviewed: "Cropped reviewed",
    metadata_only: "Metadata only",
    rendered_page: "Rendered page",
  };

  return labels[status];
}

function keepRecommendationLabel(recommendation: SourcePackKeepRecommendation) {
  const labels: Record<SourcePackKeepRecommendation, string> = {
    keep: "Keep",
    review: "Review",
    skip: "Skip",
  };

  return labels[recommendation];
}

function reviewDecisionLabel(decision: SourcePackReviewDecision) {
  const labels: Record<SourcePackReviewDecision, string> = {
    accepted: "Accepted",
    candidate: "Candidate",
    keep: "Keep",
    needs_edit: "Needs edit",
    reject: "Reject",
  };

  return labels[decision];
}

function isPreviewableAssetPath(value?: string) {
  return Boolean(value && (value.startsWith("/") || value.startsWith("http")));
}

function firstPreviewPath(candidate: SourcePackVisualReviewCandidate) {
  return [candidate.reviewAssetPath, candidate.assetPath, candidate.pageAssetPath].find(
    isPreviewableAssetPath,
  );
}

function visualCandidateTitle(candidate: SourcePackVisualReviewCandidate) {
  return (
    candidate.figureLabel ??
    candidate.tableLabel ??
    `${candidate.type === "figure" ? "Figure" : "Table"} ${candidate.id}`
  );
}

function formatBbox(candidate: SourcePackVisualReviewCandidate) {
  return candidate.bbox?.map((value) => value.toFixed(2)).join(", ") ?? "pending";
}

function sourcePackReviewBucket(
  decision: SourcePackReviewDecision,
): SourcePackReviewBucket {
  if (decision === "reject") {
    return "rejected";
  }

  if (decision === "needs_edit") {
    return "needs_edit";
  }

  if (decision === "accepted" || decision === "keep") {
    return "accepted";
  }

  return "candidate";
}

function emptySourcePackReviewCounts(): Record<SourcePackReviewBucket, number> {
  return {
    accepted: 0,
    candidate: 0,
    needs_edit: 0,
    rejected: 0,
  };
}

function countSourcePackReviewBuckets(
  decisions: SourcePackReviewDecisionRecord[],
) {
  return decisions.reduce<Record<SourcePackReviewBucket, number>>(
    (counts, decision) => {
      counts[decision.reviewBucket] += 1;
      return counts;
    },
    emptySourcePackReviewCounts(),
  );
}

function buildSourcePackReviewRun(args: {
  chunks: SourcePackChunkCandidate[];
  manifest: SourcePackManifest;
  visualCandidates: SourcePackVisualReviewCandidate[];
}): SourcePackReviewRun {
  const chunkDecisions = args.chunks.map<SourcePackReviewDecisionRecord>((chunk) => ({
    candidateId: chunk.chunkId,
    candidateType: "chunk",
    reviewBucket: sourcePackReviewBucket(chunk.reviewDecision),
    reviewDecision: chunk.reviewDecision,
    reviewerNotes: chunk.reviewNotes,
    reviewedAssetIds: [...chunk.relatedFigureIds, ...chunk.relatedTableIds],
    sourceAnchor: chunk.anchor,
    sourceId: chunk.sourceId,
  }));
  const visualDecisions =
    args.visualCandidates.map<SourcePackReviewDecisionRecord>((candidate) => ({
      candidateId: candidate.id,
      candidateType: candidate.type,
      reviewBucket: sourcePackReviewBucket(candidate.reviewDecision),
      reviewDecision: candidate.reviewDecision,
      reviewerNotes: candidate.reviewNotes,
      reviewedAssetIds: [
        candidate.reviewAssetPath,
        candidate.assetPath,
        candidate.pageAssetPath,
      ].filter((value): value is string => Boolean(value)),
      sourceAnchor: `${candidate.sourceId}#page=${candidate.page}&visual=${candidate.id}`,
      sourceId: candidate.sourceId,
    }));
  const decisions = [...chunkDecisions, ...visualDecisions];

  return {
    decisions,
    id: `${args.manifest.id}-admin-review`,
    manifestId: args.manifest.id,
    reviewCounts: countSourcePackReviewBuckets(decisions),
    stage: "admin_review_scaffold",
  };
}

function SourcePackReviewScaffold({
  chunks,
  manifest,
  visualCandidates,
}: {
  chunks: SourcePackChunkCandidate[];
  manifest: SourcePackManifest;
  visualCandidates: SourcePackVisualReviewCandidate[];
}) {
  const [activeTab, setActiveTab] = useState<SourcePackReviewTab>("chunks");
  const [decisionFilter, setDecisionFilter] = useState<SourcePackReviewDecision | "all">(
    "all",
  );
  const reviewRun = useMemo(
    () => buildSourcePackReviewRun({ chunks, manifest, visualCandidates }),
    [chunks, manifest, visualCandidates],
  );
  const figures = visualCandidates.filter((candidate) => candidate.type === "figure");
  const tables = visualCandidates.filter((candidate) => candidate.type === "table");
  const filteredChunks = chunks.filter(
    (candidate) =>
      decisionFilter === "all" || candidate.reviewDecision === decisionFilter,
  );
  const filteredVisuals = (activeTab === "figures" ? figures : tables).filter(
    (candidate) =>
      decisionFilter === "all" || candidate.reviewDecision === decisionFilter,
  );

  return (
    <section className="prompt-version-list" aria-labelledby="source-pack-visual-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Read-only source-pack review</p>
          <h3 id="source-pack-visual-title">Source Pack Review</h3>
          <p>
            Admin-side scaffold for source-pack manifests, chunk candidates,
            figures, and tables. This does not load Drive files, save review
            decisions, import product content, or publish anything.
          </p>
        </div>
        <Images size={20} aria-hidden="true" />
      </div>

      <div className="runtime-context-panel">
        <strong>{manifest.title}</strong>
        <div className="question-meta">
          <span className="pill">Pack: {manifest.id}</span>
          <span className="pill">Run: {reviewRun.id}</span>
          <span className="pill">{manifest.sourceCount} sources</span>
          <span className="pill">{manifest.chunkCount} chunks</span>
          <span className="pill">{manifest.figureCount} figures</span>
          <span className="pill">{manifest.tableCount} tables</span>
          <span className="pill">Created {formatDate(manifest.createdAt)}</span>
        </div>
        <p>Sources: {manifest.sourceIds.join(", ")}</p>
      </div>

      <div className="study-stat-strip" aria-label="Source-pack visual review summary">
        <div className="study-stat-chip">
          <strong>{chunks.length}</strong>
          <span>Chunk candidates</span>
        </div>
        <div className="study-stat-chip">
          <strong>{figures.length}</strong>
          <span>Figures</span>
        </div>
        <div className="study-stat-chip">
          <strong>{tables.length}</strong>
          <span>Tables</span>
        </div>
        <div className="study-stat-chip">
          <strong>{reviewRun.decisions.length}</strong>
          <span>Review decisions</span>
        </div>
      </div>

      <SourcePackReviewSummaryPanel reviewRun={reviewRun} />

      <div className="component-tabs" aria-label="Source-pack review tabs">
        {(["chunks", "figures", "tables"] as SourcePackReviewTab[]).map((tab) => (
          <button
            className={activeTab === tab ? "active" : undefined}
            key={tab}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {tab === "chunks" && <FileText size={18} />}
            {tab === "figures" && <Images size={18} />}
            {tab === "tables" && <Table2 size={18} />}
            {tab === "chunks" ? "Chunks" : tab === "figures" ? "Figures" : "Tables"}
          </button>
        ))}
      </div>

      <div className="field-grid">
        <label>
          <span>Review state filter</span>
          <select
            onChange={(event) =>
              setDecisionFilter(event.target.value as SourcePackReviewDecision | "all")
            }
            value={decisionFilter}
          >
            <option value="all">All review states</option>
            <option value="candidate">Candidate</option>
            <option value="keep">Keep</option>
            <option value="reject">Reject</option>
            <option value="needs_edit">Needs edit</option>
            <option value="accepted">Accepted</option>
          </select>
        </label>
      </div>

      <div className="runtime-context-panel">
        <strong>Read-only API contract</strong>
        <p>
          Future loader should return manifest metadata, source-page anchors,
          chunk ids, figure/table ids, captions, source context, tags/subjects,
          use cases, related item ids, review states, and asset paths when the
          admin has a browser-safe preview URL.
        </p>
        <div className="question-meta">
          <span className="pill">No filesystem reads in browser</span>
          <span className="pill">No Drive integration yet</span>
          <span className="pill">No durable review writes</span>
          <span className="pill">No publish writes</span>
        </div>
      </div>

      <div className="component-tabs" aria-label="Future source-pack actions">
        <button disabled type="button">
          <CheckCircle2 size={18} />
          Accept selected
        </button>
        <button disabled type="button">
          <AlertCircle size={18} />
          Reject selected
        </button>
        <button disabled type="button">
          <ShieldCheck size={18} />
          Generate Study draft from accepted chunks
        </button>
        <button disabled type="button">
          <ShieldCheck size={18} />
          Generate DPE draft later
        </button>
      </div>

      <div className="question-list">
        {activeTab === "chunks" &&
          filteredChunks.map((candidate) => (
            <ChunkCandidateCard candidate={candidate} key={candidate.chunkId} />
          ))}
        {activeTab !== "chunks" &&
          filteredVisuals.map((candidate) => (
            <VisualCandidateCard candidate={candidate} key={candidate.id} />
          ))}
        {((activeTab === "chunks" && filteredChunks.length === 0) ||
          (activeTab !== "chunks" && filteredVisuals.length === 0)) && (
          <div className="runtime-context-panel">
            <p>No source-pack candidates match this filter.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function SourcePackReviewSummaryPanel({
  reviewRun,
}: {
  reviewRun: SourcePackReviewRun;
}) {
  return (
    <div className="runtime-context-panel">
      <div className="section-head">
        <div>
          <strong>Review summary</strong>
          <p>
            Read-only decision rollup for the next export contract. Accepted
            chunks are the intended first input for future Study draft
            generation; DPE handoff stays later.
          </p>
        </div>
        <span className="pill">{reviewRun.stage.replaceAll("_", " ")}</span>
      </div>
      <div className="study-stat-strip" aria-label="Source-pack review decision summary">
        <div className="study-stat-chip highlight">
          <strong>{reviewRun.reviewCounts.accepted}</strong>
          <span>Accepted</span>
        </div>
        <div className="study-stat-chip">
          <strong>{reviewRun.reviewCounts.rejected}</strong>
          <span>Rejected</span>
        </div>
        <div className="study-stat-chip">
          <strong>{reviewRun.reviewCounts.needs_edit}</strong>
          <span>Needs edit</span>
        </div>
        <div className="study-stat-chip">
          <strong>{reviewRun.reviewCounts.candidate}</strong>
          <span>Candidate</span>
        </div>
      </div>
      <div className="question-meta">
        {reviewRun.decisions.slice(0, 5).map((decision) => (
          <span className="pill" key={`${decision.candidateType}-${decision.candidateId}`}>
            {decision.candidateType}: {decision.candidateId} {"->"}{" "}
            {reviewDecisionLabel(decision.reviewDecision)}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChunkCandidateCard({ candidate }: { candidate: SourcePackChunkCandidate }) {
  return (
    <article className="runtime-context-panel">
      <div className="section-head">
        <div>
          <div className="question-meta">
            <span className="pill">Chunk</span>
            <span className="pill">{reviewDecisionLabel(candidate.reviewDecision)}</span>
            <span className="pill">Page {candidate.page}</span>
          </div>
          <strong>{candidate.chunkId}</strong>
          <p>{candidate.excerpt}</p>
        </div>
        <FileText size={20} aria-hidden="true" />
      </div>

      {candidate.contextBefore && (
        <div className="runtime-context-panel">
          <strong>Context</strong>
          <p>{candidate.contextBefore}</p>
        </div>
      )}

      <div className="question-meta">
        <span className="pill">Source: {candidate.sourceTitle}</span>
        <span className="pill">Anchor: {candidate.anchor}</span>
        {candidate.subjects.map((subject) => (
          <span className="pill" key={subject}>
            {subject}
          </span>
        ))}
        {candidate.tags.map((tag) => (
          <span className="pill" key={tag}>
            {tag}
          </span>
        ))}
        {candidate.useCases.map((useCase) => (
          <span className="pill" key={useCase}>
            Use: {useCase}
          </span>
        ))}
      </div>

      <div className="question-meta">
        <span className="pill">
          Figures: {candidate.relatedFigureIds.join(", ") || "none"}
        </span>
        <span className="pill">Tables: {candidate.relatedTableIds.join(", ") || "none"}</span>
      </div>

      <div className="runtime-context-panel">
        <strong>Reviewer notes</strong>
        <p>{candidate.reviewNotes ?? "No notes yet."}</p>
      </div>
    </article>
  );
}

function VisualCandidateCard({
  candidate,
}: {
  candidate: SourcePackVisualReviewCandidate;
}) {
  const previewPath = firstPreviewPath(candidate);

  return (
    <article className="runtime-context-panel">
      <div className="section-head">
        <div>
          <div className="question-meta">
            <span className="pill">{candidate.type === "figure" ? "Figure" : "Table"}</span>
            <span className="pill">{reviewDecisionLabel(candidate.reviewDecision)}</span>
            <span className="pill">{visualStatusLabel(candidate.reviewStatus)}</span>
            <span className="pill">
              Recommendation: {keepRecommendationLabel(candidate.keepRecommendation)}
            </span>
          </div>
          <strong>{visualCandidateTitle(candidate)}</strong>
          <p>{candidate.caption ?? "Caption pending."}</p>
        </div>
        {candidate.type === "figure" ? (
          <Images size={20} aria-hidden="true" />
        ) : (
          <Table2 size={20} aria-hidden="true" />
        )}
      </div>

      <div className="study-stat-strip" aria-label={`${candidate.id} metadata`}>
        <div className="study-stat-chip">
          <strong>{candidate.page}</strong>
          <span>Page</span>
        </div>
        <div className="study-stat-chip">
          <strong>{candidate.relatedChunkIds.length}</strong>
          <span>Linked chunks</span>
        </div>
        <div className="study-stat-chip">
          <strong>{candidate.subject ?? "Pending"}</strong>
          <span>Subject</span>
        </div>
        <div className="study-stat-chip highlight">
          <strong>{candidate.topic ?? "Pending"}</strong>
          <span>Topic</span>
        </div>
      </div>

      {previewPath ? (
        <figure className="runtime-context-panel">
          <Image
            alt={candidate.caption ?? visualCandidateTitle(candidate)}
            height={420}
            src={previewPath}
            style={{ height: "auto", width: "100%" }}
            unoptimized
            width={720}
          />
          <figcaption>Preview asset: {previewPath}</figcaption>
        </figure>
      ) : (
        <div className="runtime-context-panel">
          <Eye size={18} aria-hidden="true" />
          <div>
            <strong>Preview pending</strong>
            <p>
              No browser-previewable URL is available yet. Stored asset paths:
              {[candidate.reviewAssetPath, candidate.assetPath, candidate.pageAssetPath]
                .filter(Boolean)
                .join(", ") || " none"}
            </p>
          </div>
        </div>
      )}

      <div className="question-meta">
        <span className="pill">Source: {candidate.sourceTitle}</span>
        <span className="pill">Source id: {candidate.sourceId}</span>
        <span className="pill">Page {candidate.page}</span>
        <span className="pill">BBox: {formatBbox(candidate)}</span>
        {candidate.subtopics?.map((subtopic) => (
          <span className="pill" key={subtopic}>
            {subtopic}
          </span>
        ))}
        {candidate.useCases?.map((useCase) => (
          <span className="pill" key={useCase}>
            Use: {useCase}
          </span>
        ))}
      </div>

      {candidate.sourceExcerpt && (
        <div className="runtime-context-panel">
          <strong>Source/chunk context</strong>
          <p>{candidate.sourceExcerpt}</p>
        </div>
      )}

      <div className="runtime-context-panel">
        <strong>Reviewer notes</strong>
        <p>{candidate.reviewNotes ?? "No notes yet."}</p>
        {candidate.instructionalValue && <p>Instructional value: {candidate.instructionalValue}</p>}
      </div>
    </article>
  );
}

function DraftReviewPanel({ run }: { run: ContentStudioDraftRun }) {
  if (run.pipelineKey === "dpe_content") {
    return <DpeDraftReviewPanel run={run} />;
  }

  return <StudyDraftReviewPanel run={run} />;
}

function ReviewStatePanel({
  onNotesChange,
  onSave,
  onStatusChange,
  reviewerNotes,
  run,
  saveStatus,
  status,
}: {
  onNotesChange: (value: string) => void;
  onSave: () => void;
  onStatusChange: (value: ContentStudioRunStatus) => void;
  reviewerNotes: string;
  run: ContentStudioDraftRun;
  saveStatus: SaveReviewStatus;
  status: ContentStudioRunStatus;
}) {
  return (
    <section className="prompt-version-list" aria-labelledby="review-state-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Saved review state</p>
          <h3 id="review-state-title">{pipelineHistoryLabel(run.pipelineKey)}</h3>
          <p>
            This run is saved for Admin review. Approved for publish is an internal
            review status only and does not publish product content.
          </p>
        </div>
        <span>{statusLabel(run.status)}</span>
      </div>

      <div className="study-stat-strip" aria-label="Saved run status">
        <div className="study-stat-chip">
          <strong>{run.id.slice(0, 8)}</strong>
          <span>Run id</span>
        </div>
        <div className="study-stat-chip">
          <strong>{formatDate(run.updatedAt)}</strong>
          <span>Last saved</span>
        </div>
        <div className="study-stat-chip highlight">
          <strong>Disabled</strong>
          <span>Publish controls</span>
        </div>
      </div>

      <div className="field-grid">
        <label>
          <span>Review status</span>
          <select
            onChange={(event) =>
              onStatusChange(event.target.value as ContentStudioRunStatus)
            }
            value={status}
          >
            <option value="draft_ready">Draft ready</option>
            <option value="needs_revision">Needs revision</option>
            <option value="approved_for_publish">
              Approved for publish review (not published)
            </option>
            <option value="archived">Archived</option>
            <option disabled value="failed">Failed</option>
          </select>
        </label>

        <label>
          <span>Reviewer notes</span>
          <textarea
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="Capture source concerns, revision instructions, approval rationale, or product handoff notes."
            value={reviewerNotes}
          />
        </label>
      </div>

      <div className="component-tabs" aria-label="Review state actions">
        <button
          disabled={saveStatus === "saving" || run.status === "failed"}
          onClick={onSave}
          type="button"
        >
          <CheckCircle2 size={18} />
          {saveStatus === "saving"
            ? "Saving"
            : saveStatus === "saved"
              ? "Saved"
              : "Save review state"}
        </button>
        <button disabled type="button">
          <ShieldCheck size={18} />
          Publish disabled
        </button>
      </div>
    </section>
  );
}

function DpeContextFields({
  context,
  onChange,
  onTrackChange,
}: {
  context: DpeDraftContext;
  onChange: (group: "acs" | "certificate", key: string, value: string) => void;
  onTrackChange: (trackKey: DpeTargetTrackKey | "") => void;
}) {
  const track = context.targetTrackKey ? findDpeTargetTrack(context.targetTrackKey) : undefined;

  return (
    <div className="runtime-context-panel">
      <strong>DPE context</strong>
      <p>Track and certificate context are review-only inputs. They improve draft grounding and do not publish content.</p>
      <div className="field-grid">
        <label>
          <span>Target track</span>
          <select
            onChange={(event) => onTrackChange(parseDpeTargetTrackKey(event.target.value) ?? "")}
            value={context.targetTrackKey}
          >
            <option value="">Custom / not selected</option>
            {dpeTargetTracks.map((trackOption) => (
              <option key={trackOption.key} value={trackOption.key}>
                {trackOption.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Certificate title</span>
          <input
            onChange={(event) => onChange("certificate", "title", event.target.value)}
            placeholder="Private Pilot Airplane Single-Engine Land"
            value={context.certificate.title}
          />
        </label>
        <label>
          <span>Certificate code</span>
          <input
            onChange={(event) => onChange("certificate", "code", event.target.value)}
            placeholder="PPL-ASEL"
            value={context.certificate.code}
          />
        </label>
        <div className="runtime-context-panel">
          <strong>Track note</strong>
          <p>
            {track
              ? `${track.label}: ${track.description}`
              : "Pick a target track to preload the certificate context for MVP coverage review."}
          </p>
        </div>
        <label>
          <span>ACS area</span>
          <input
            onChange={(event) => onChange("acs", "area", event.target.value)}
            placeholder="Area of Operation"
            value={context.acs.area}
          />
        </label>
        <label>
          <span>ACS task</span>
          <input
            onChange={(event) => onChange("acs", "task", event.target.value)}
            placeholder="Task"
            value={context.acs.task}
          />
        </label>
        <label>
          <span>ACS reference</span>
          <input
            onChange={(event) => onChange("acs", "reference", event.target.value)}
            placeholder="PA.I.A.K1"
            value={context.acs.reference}
          />
        </label>
        <label>
          <span>ACS element type</span>
          <input
            onChange={(event) => onChange("acs", "elementType", event.target.value)}
            placeholder="Knowledge, Risk Management, or Skill"
            value={context.acs.elementType}
          />
        </label>
      </div>
    </div>
  );
}

function StudyDraftReviewPanel({ run }: { run: StudyDraftRun }) {
  return (
    <section className="prompt-version-list" aria-labelledby="draft-review-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Review</p>
          <h3 id="draft-review-title">{run.draft.title}</h3>
          <p>{run.draft.description}</p>
        </div>
        <span>{run.draft.generationMode === "ai" ? "AI draft" : "Fallback draft"}</span>
      </div>

      <div className="study-stat-strip" aria-label="Draft review summary">
        <div className="study-stat-chip">
          <strong>{run.draft.cards.length}</strong>
          <span>Draft cards</span>
        </div>
        <div className="study-stat-chip">
          <strong>{run.draft.generationWarnings.length}</strong>
          <span>Warnings</span>
        </div>
        <div className="study-stat-chip highlight">
          <strong>Review</strong>
          <span>Not verified</span>
        </div>
      </div>

      <div className="runtime-context-panel">
        <strong>Source summary</strong>
        <p>{run.draft.sourceSummary}</p>
      </div>

      {run.draft.generationWarnings.length > 0 && (
        <div className="runtime-context-panel">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <strong>Generation warnings</strong>
            <ul>
              {run.draft.generationWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="question-list">
        {run.draft.cards.map((card, index) => (
          <article className="runtime-context-panel" key={`${card.question}-${index}`}>
            <div className="question-meta">
              <span className="pill">Card {index + 1}</span>
              <span className="pill">{card.level}</span>
              <span className="pill">{confidenceLabel(card.confidence)}</span>
            </div>
            <strong>{card.question}</strong>
            <p>{card.answer}</p>
            {card.hint && <p>Hint: {card.hint}</p>}
            {card.sourceNotes && <p>Source notes: {card.sourceNotes}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function DpeDraftReviewPanel({ run }: { run: DpeDraftRun }) {
  const draft = run.draft;
  const trackLabel = runTrackLabel(run);

  return (
    <section className="prompt-version-list" aria-labelledby="dpe-draft-review-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Review</p>
          <h3 id="dpe-draft-review-title">DPE content draft</h3>
          <p>{draft.sourceSummary}</p>
        </div>
        <span>{draft.generation.mode === "ai" ? "AI draft" : "Fallback draft"}</span>
      </div>

      <div className="study-stat-strip" aria-label="DPE draft readiness summary">
        <div className="study-stat-chip">
          <strong>{draft.readiness.readyToReview ? "Ready" : "Needs work"}</strong>
          <span>Review status</span>
        </div>
        <div className="study-stat-chip">
          <strong>{Math.round(draft.confidence * 100)}%</strong>
          <span>Confidence</span>
        </div>
        <div className="study-stat-chip highlight">
          <strong>{draft.readiness.missingFields.length}</strong>
          <span>Missing fields</span>
        </div>
      </div>

      <div className="runtime-context-panel">
        <strong>Certificate</strong>
        <div className="question-meta">
          {trackLabel && <span className="pill">{trackLabel}</span>}
          <span className="pill">{draft.certificate.title || "Title missing"}</span>
          <span className="pill">{draft.certificate.code || "Code missing"}</span>
          <span className="pill">{draft.certificate.id || "ID missing"}</span>
        </div>
      </div>

      <div className="runtime-context-panel">
        <strong>ACS</strong>
        <div className="question-meta">
          <span className="pill">Area: {draft.acs.area || "missing"}</span>
          <span className="pill">Task: {draft.acs.task || "missing"}</span>
          <span className="pill">Reference: {draft.acs.reference || "missing"}</span>
          <span className="pill">Type: {draft.acs.elementType || "missing"}</span>
        </div>
        {draft.acs.title && <p>{draft.acs.title}</p>}
      </div>

      <div className="runtime-context-panel">
        <strong>Oral question</strong>
        <p>{draft.oralQuestion.questionText || "Question text missing."}</p>
        <div className="question-meta">
          <span className="pill">{draft.oralQuestion.questionMode}</span>
          <span className="pill">
            {draft.oralQuestion.primarySubject || "Subject pending"}
          </span>
          <span className="pill">
            {draft.oralQuestion.acsElementType || "Element type pending"}
          </span>
        </div>
      </div>

      <div className="runtime-context-panel">
        <strong>Answer key</strong>
        <ReviewList title="Correct answer elements" values={draft.answerKey.correctAnswerElements} />
        <ReviewList title="Acceptable variations" values={draft.answerKey.acceptableVariations} />
        <ReviewList title="Common misses" values={draft.answerKey.commonMisses} />
        <ReviewList title="Source references" values={draft.answerKey.sourceReferences} />
        {draft.answerKey.notes && <p>Notes: {draft.answerKey.notes}</p>}
      </div>

      <div className="runtime-context-panel">
        <strong>Rubric</strong>
        <p>Knowledge: {draft.rubric.knowledge || "Missing"}</p>
        <p>Risk management: {draft.rubric.riskManagement || "Missing"}</p>
        <p>Scenario judgment: {draft.rubric.scenarioJudgment || "Missing"}</p>
        <p>Communication: {draft.rubric.communication || "Missing"}</p>
        <p>Checkride readiness: {draft.rubric.checkrideReadiness || "Missing"}</p>
        {draft.rubric.scoringNotes && <p>Scoring notes: {draft.rubric.scoringNotes}</p>}
      </div>

      <div className="runtime-context-panel">
        <strong>Reviewer indicators</strong>
        <div className="question-meta">
          <span className="pill">
            Certificate: {draft.readiness.hasCertificate ? "present" : "missing"}
          </span>
          <span className="pill">
            ACS task: {draft.readiness.hasAcsTask ? "present" : "missing"}
          </span>
          <span className="pill">
            ACS reference: {draft.readiness.hasAcsReference ? "present" : "missing"}
          </span>
          <span className="pill">
            Question: {draft.readiness.hasQuestion ? "present" : "missing"}
          </span>
          <span className="pill">
            Answer key: {draft.readiness.hasAnswerKey ? "present" : "missing"}
          </span>
          <span className="pill">
            Rubric: {draft.readiness.hasRubric ? "present" : "missing"}
          </span>
        </div>
        {draft.readiness.missingFields.length > 0 ? (
          <ReviewList title="Missing fields" values={draft.readiness.missingFields} />
        ) : (
          <p>No missing fields reported by the draft generator.</p>
        )}
      </div>

      {draft.warnings.length > 0 && (
        <div className="runtime-context-panel">
          <AlertCircle size={18} aria-hidden="true" />
          <ReviewList title="Warnings" values={draft.warnings} />
        </div>
      )}
    </section>
  );
}

function ReviewList({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <strong>{title}</strong>
      {values.length > 0 ? (
        <ul>
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <p>None provided.</p>
      )}
    </div>
  );
}
