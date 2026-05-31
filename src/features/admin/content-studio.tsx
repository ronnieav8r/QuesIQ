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
  generationMode: "ai" | "mock" | "source_pack_review_export";
  generationWarnings: string[];
  missingFields?: string[];
  promptInstructions?: string;
  reviewChecklist?: Record<string, boolean>;
  sourcePackReviewExport?: SourcePackReviewExport;
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

type SourcePackReviewExport = {
  acceptedChunkIds: string[];
  acceptedVisualIds: string[];
  manifest: {
    id: string;
    sourceIds: string[];
    title: string;
  };
  notes: Array<{
    candidateId: string;
    candidateType: string;
    note: string;
  }>;
  restrictions: string[];
  reviewCounts: Record<SourcePackReviewBucket, number>;
  reviewedVisualIds: string[];
  reviewRunId: string;
  sourceAnchors: Array<{
    candidateId: string;
    candidateType: string;
    sourceAnchor: string;
    sourceId: string;
  }>;
  stage: "source_pack_admin_review_export_preview";
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

type SourcePackPreviewResponse = {
  chunks?: SourcePackChunkCandidate[];
  error?: string;
  manifest?: SourcePackManifest;
  reviewRun?: SourcePackReviewRun;
  storage?: {
    detail: string;
    durableReviewState: boolean;
  };
  validationErrors?: string[];
  visualCandidates?: SourcePackVisualReviewCandidate[];
};

type ProductPacketPreviewKind = "dpe_reference" | "study_deck_draft" | "study_generation";
type ProductPacketPreviewStatus = "idle" | "previewing" | "ready";

type ProductPacketReviewSection = {
  items: string[];
  title: string;
};

type StudyGenerationPacketPreviewResponse = {
  error?: string;
  generationPacket?: {
    chunks?: unknown[];
    deckRequest?: {
      cardTarget?: number;
      subject?: string;
      title?: string;
    };
    sourcePack?: {
      pageRange?: {
        endPage?: number;
        startPage?: number;
      };
      sourcePackId?: string;
      title?: string;
    };
  };
  generationPacketPreviewOnly?: boolean;
  reviewSections?: ProductPacketReviewSection[];
  validationErrors?: string[];
};

type StudyDeckDraftPreviewResponse = {
  draftContract?: {
    draft?: {
      cards?: unknown[];
      draftId?: string;
      sourcePackId?: string;
      title?: string;
      verificationStatus?: string;
    };
  };
  error?: string;
  reviewSections?: ProductPacketReviewSection[];
  sourcePackPreviewOnly?: boolean;
  validationErrors?: string[];
};

type StudyVerificationQueuePreviewResponse = {
  error?: string;
  queuePreview?: {
    draftId: string;
    queueItems: Array<{
      cardIndex: number;
      question: string;
      recommendedVerifierAction: string;
      recommendedVerifierStatus: string;
      sourceCitation?: {
        chunkIds?: string[];
        pageAnchors?: unknown[];
        sourcePackId?: string;
        visualAssetIds?: string[];
      };
    }>;
    sourcePackId: string;
    summary: {
      cardCount: number;
      pageAnchorsCount: number;
      title: string;
      uniqueChunkIds: number;
      uniqueVisualAssetIds: number;
      verificationStatusCounts: Record<string, number>;
      warningCounts: {
        blocker: number;
        info: number;
        warning: number;
      };
    };
  };
  reviewSections?: ProductPacketReviewSection[];
  sourcePackVerificationQueuePreviewOnly?: boolean;
  validationErrors?: string[];
};

type StudyDeckDraftProductPacketPreviewResponse = {
  deckDraftPreview: StudyDeckDraftPreviewResponse;
  error?: string;
  verificationQueuePreview: StudyVerificationQueuePreviewResponse;
};

type DpeReferencePacketPreviewResponse = {
  draftReferenceContract?: {
    items?: unknown[];
    warnings?: string[];
  };
  error?: string;
  mode?: "source_pack_reference_packet_preview";
  reviewSummary?: {
    itemCount: number;
    itemsByVerificationStatus: Record<string, number>;
    sourceChunkCount: number;
    sourcePack: {
      id: string;
      title: string;
    };
    trackApplicability: string[];
    visualAssetCount: number;
  };
};

type ProductPacketPreviewResponse =
  | DpeReferencePacketPreviewResponse
  | StudyDeckDraftProductPacketPreviewResponse
  | StudyGenerationPacketPreviewResponse;

type StudyRichCsvImportIssue = {
  message: string;
  row: number;
  severity: "error" | "warning";
};

type StudyRichCsvImportPreviewRow = {
  answer: string;
  draftId?: string;
  externalId?: string;
  hint?: string;
  level?: string;
  question: string;
  source: {
    sourceChunkIds?: string[];
    sourceLabel?: string;
    sourcePackId?: string;
    sourcePages?: number[];
    sourceUrl?: string;
    sourceVisualAssetIds?: string[];
  };
  tags?: string[];
  verification: {
    confidence?: number;
    evidence?: string[];
    notes?: string;
    status?: string;
    verifier?: string;
  };
};

type StudyRichCsvImportPreviewResponse = {
  csvHeaders?: string[];
  delimiter?: "," | "\t";
  error?: string;
  richCsvImportPreviewOnly?: boolean;
  richCsvImportSaved?: boolean;
  rowCount?: number;
  rows?: StudyRichCsvImportPreviewRow[];
  saveResult?: {
    createdCardCount: number;
    createdSourceCount: number;
    createdVerificationCount: number;
    deckId: string;
    deckImportId: string;
    rowsProcessed: number;
    verifiedCardCount: number;
  };
  sourceCoverage?: {
    sourcePackIds: string[];
    uniqueChunkIds: number;
    uniquePages: number;
    uniqueVisualAssetIds: number;
  };
  storage?: {
    detail: string;
    durableReviewState: boolean;
  };
  validationErrors?: StudyRichCsvImportIssue[];
  validationWarnings?: StudyRichCsvImportIssue[];
  verificationStatusCounts?: Record<string, number>;
};

type StudyRichCsvTargetField =
  | "answer"
  | "audience"
  | "deckDescription"
  | "deckTitle"
  | "draftConfidence"
  | "draftId"
  | "draftWarnings"
  | "externalId"
  | "hint"
  | "level"
  | "question"
  | "sourceChunkIds"
  | "sourceLabel"
  | "sourceNotes"
  | "sourcePackId"
  | "sourcePackTitle"
  | "sourcePages"
  | "sourceUrl"
  | "sourceVisualAssetIds"
  | "subject"
  | "tags"
  | "verificationConfidence"
  | "verificationEvidence"
  | "verificationNotes"
  | "verificationStatus"
  | "verifier";

type StudyRichCsvColumnMapping = Record<StudyRichCsvTargetField, string>;

type ContentStudioWorkspaceSection =
  | "draft_review"
  | "overview"
  | "product_packet"
  | "source_review"
  | "study_import_prep";

const contentStudioWorkspaceSections: ContentStudioWorkspaceSection[] = [
  "overview",
  "source_review",
  "product_packet",
  "study_import_prep",
  "draft_review",
];

const MIN_SOURCE_CHARS = 40;

const studyRichCsvSkillHeaders: StudyRichCsvTargetField[] = [
  "externalId",
  "deckTitle",
  "deckDescription",
  "subject",
  "audience",
  "question",
  "answer",
  "hint",
  "level",
  "tags",
  "sourcePackId",
  "sourcePackTitle",
  "sourceChunkIds",
  "sourcePages",
  "sourceVisualAssetIds",
  "sourceLabel",
  "sourceUrl",
  "sourceNotes",
  "draftId",
  "draftConfidence",
  "draftWarnings",
  "verificationStatus",
  "verificationConfidence",
  "verificationNotes",
  "verificationEvidence",
  "verifier",
];

const studyRichCsvRequiredFields: StudyRichCsvTargetField[] = [
  "question",
  "answer",
];

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

const sourcePackPreviewSample = JSON.stringify(
  {
    chunks: sourcePackChunkCandidates,
    figures: sourcePackVisualCandidates.filter((candidate) => candidate.type === "figure"),
    manifest: sourcePackManifest,
    tables: sourcePackVisualCandidates.filter((candidate) => candidate.type === "table"),
  },
  null,
  2,
);

const studyGenerationPacketPreviewSample = JSON.stringify(
  {
    chunks: [
      {
        chunkId: "chunk-001",
        pageAnchors: [{ page: 12, x1: 0.1, x2: 0.8, y1: 0.2, y2: 0.5 }],
        relatedVisualIds: ["figure-12-a"],
        snippet: "Stabilize pitch and trim before introducing larger control input.",
        tags: ["fundamentals", "flight-controls"],
      },
    ],
    deckRequest: {
      cardTarget: 12,
      subject: "Flight Fundamentals",
      title: "Stability And Control Draft",
    },
    instructions: "Focus on source-grounded prompts and concise answers.",
    outputRestrictions: {
      canMarkOfficial: false,
      canMarkVerified: false,
      canPublish: false,
      canWriteStudyRuntime: false,
      writesStudyDecks: false,
    },
    packetVersion: "quesiq.studyGenerationPacket.v1",
    sourcePack: {
      pageRange: {
        endPage: 20,
        startPage: 10,
      },
      sourcePackId: "sample-source-pack",
      title: "Sample Source Pack",
    },
    targetContract: "study.sourcePackDeckDraft.v1",
  },
  null,
  2,
);

const dpeReferencePacketPreviewSample = JSON.stringify(
  {
    items: [
      {
        acsTags: ["PA.I.A.K1"],
        pageAnchors: ["sample-source-pack#page=12"],
        promptReference: "Use pitch, power, trim, and outside references to stabilize the airplane.",
        referenceId: "ref-001",
        sourceChunkIds: ["chunk-001"],
        subjectTags: ["flight controls"],
        trackApplicability: ["PPL-ASEL"],
        verificationStatus: "needs_admin_review",
        visualAssetIds: ["figure-12-a"],
        warnings: [],
      },
    ],
    mode: "draft_admin_reference_only",
    packetVersion: "quesiq.dpeReferencePacket.v1",
    restrictions: {
      durableSourcePackStorage: false,
      learnerRuntimeReads: false,
      officialWrites: false,
      publishWrites: false,
      verifiedWrites: false,
    },
    sourcePack: {
      id: "sample-source-pack",
      pageRange: {
        end: 20,
        start: 10,
      },
      title: "Sample Source Pack",
    },
    targetContract: "dpe.draftReference.v1",
  },
  null,
  2,
);

const studyDeckDraftPreviewSample = JSON.stringify(
  {
    contractVersion: "study.sourcePackDeckDraft.v1",
    draft: {
      cards: [
        {
          answer: "Use small, deliberate control pressures while scanning outside for references.",
          hint: "Start with pitch trim before making larger control inputs.",
          level: "beginner",
          question: "What is a stable way to maintain control during visual maneuver practice?",
          sourceCitation: {
            chunkIds: ["chunk-001", "chunk-002"],
            pageAnchors: [{ page: 12, x1: 0.12, x2: 0.75, y1: 0.18, y2: 0.42 }],
            sourcePackId: "sample-source-pack",
            visualAssetIds: ["figure-12-a"],
          },
          tags: ["fundamentals", "visual-maneuvers"],
          verificationStatus: "unverified",
          warnings: [
            {
              code: "needs_verifier_pass",
              message: "Requires verifier pass before Study import.",
              severity: "warning",
            },
          ],
        },
      ],
      deckWarnings: [
        {
          code: "sample_only",
          message: "Sample contract fixture for preview and validation only.",
          severity: "info",
        },
      ],
      description: "Sample source-pack-generated Study draft contract payload.",
      draftId: "sample-draft-001",
      generatedAt: "2026-01-01T00:00:00.000Z",
      sourcePackId: "sample-source-pack",
      subject: "Flight Fundamentals",
      tags: ["content-studio", "draft-only"],
      title: "Sample Source-Pack Draft Deck",
      verificationStatus: "needs_review",
    },
    mode: "draft_preview_only",
    restrictions: {
      canMarkOfficial: false,
      canMarkVerified: false,
      canPublish: false,
      writesStudyDecks: false,
    },
  },
  null,
  2,
);

const studyRichCsvPreviewSample = `externalId,deckTitle,deckDescription,subject,audience,question,answer,hint,level,tags,sourcePackId,sourcePackTitle,sourceChunkIds,sourcePages,sourceVisualAssetIds,sourceLabel,sourceUrl,sourceNotes,draftId,draftConfidence,draftWarnings,verificationStatus,verificationConfidence,verificationNotes,verificationEvidence,verifier
sample-001,Rich CSV Sample Import,Imported through Admin Content Studio rich CSV.,Flight Fundamentals,Private Pilot,What is the purpose of trim?,To relieve control pressure in steady flight.,Set pitch first then trim.,beginner,fundamentals|flight-controls,sample-source-pack,Sample Source Pack,chunk-001|chunk-002,12|13,figure-12-a,PHAK chapter 4,https://example.com/phak/ch4,Use with source-linked context,draft-001,0.86,needs_review_pass,needs_review,0.74,Verifier pass pending,evidence-001|evidence-002,admin-reviewer`;

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

function isSourcePackReviewExportRun(run: ContentStudioDraftRun) {
  return (
    run.pipelineKey === "study_flashcards" &&
    run.stage === "source_pack_admin_review_export_preview" &&
    run.draft.generationMode === "source_pack_review_export"
  );
}

function contentStudioRunLabel(run: ContentStudioDraftRun) {
  if (isSourcePackReviewExportRun(run)) {
    return "Source-pack review export";
  }

  return run.pipelineKey === "dpe_content" ? "DPE content draft" : "Study flashcard draft";
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

function splitCsvLine(line: string, delimiter: "," | "\t") {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values.filter(Boolean);
}

function detectStudyRichCsvHeaders(csvText: string) {
  const firstLine = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return {
      delimiter: "," as const,
      headers: [] as string[],
    };
  }

  const delimiter = firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
  return {
    delimiter,
    headers: splitCsvLine(firstLine, delimiter),
  };
}

function buildStudyRichCsvDefaultColumnMapping(): StudyRichCsvColumnMapping {
  return studyRichCsvSkillHeaders.reduce<StudyRichCsvColumnMapping>(
    (mapping, field) => {
      mapping[field] = field;
      return mapping;
    },
    {} as StudyRichCsvColumnMapping,
  );
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

function parseContentStudioWorkspaceSection(
  value: string | null,
): ContentStudioWorkspaceSection {
  return contentStudioWorkspaceSections.includes(value as ContentStudioWorkspaceSection)
    ? (value as ContentStudioWorkspaceSection)
    : "overview";
}

function initialContentStudioUrlState() {
  if (typeof window === "undefined") {
    return {
      dpeContext: emptyDpeContext,
      pipelineKey: "study_flashcards" as ContentStudioPipelineKey,
      selectedTemplate: contentStudioTemplatesByPipeline.study_flashcards[0].value,
      sourceText: "",
      workspaceSection: "overview" as ContentStudioWorkspaceSection,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const workspaceSection = parseContentStudioWorkspaceSection(
    params.get("contentStudioWorkspace"),
  );

  if (params.get("pipeline") !== "dpe_content") {
    return {
      dpeContext: emptyDpeContext,
      pipelineKey: "study_flashcards" as ContentStudioPipelineKey,
      selectedTemplate: contentStudioTemplatesByPipeline.study_flashcards[0].value,
      sourceText: "",
      workspaceSection,
    };
  }

  return {
    dpeContext: dpeContextFromSearchParams(params),
    pipelineKey: "dpe_content" as ContentStudioPipelineKey,
    selectedTemplate: contentStudioTemplatesByPipeline.dpe_content[0].value,
    sourceText: params.get("sourceText") ?? "",
    workspaceSection,
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
  const [sourcePackPreviewInput, setSourcePackPreviewInput] = useState("");
  const [sourcePackPreview, setSourcePackPreview] =
    useState<SourcePackPreviewResponse>();
  const [sourcePackPreviewStatus, setSourcePackPreviewStatus] =
    useState<"idle" | "previewing" | "ready">("idle");
  const [sourcePackPreviewError, setSourcePackPreviewError] = useState<string>();
  const [sourcePackPreviewVersion, setSourcePackPreviewVersion] = useState(0);
  const [productPacketKind, setProductPacketKind] =
    useState<ProductPacketPreviewKind>("study_generation");
  const [productPacketInput, setProductPacketInput] = useState("");
  const [productPacketPreview, setProductPacketPreview] =
    useState<ProductPacketPreviewResponse>();
  const [productPacketPreviewStatus, setProductPacketPreviewStatus] =
    useState<ProductPacketPreviewStatus>("idle");
  const [productPacketPreviewError, setProductPacketPreviewError] = useState<string>();
  const [productPacketValidationErrors, setProductPacketValidationErrors] =
    useState<string[]>([]);
  const [workspaceSection, setWorkspaceSection] =
    useState<ContentStudioWorkspaceSection>(urlState.workspaceSection);
  const [studyImportPrepInput, setStudyImportPrepInput] = useState("");
  const [studyImportDeckId, setStudyImportDeckId] = useState("");
  const [studyImportDeckDescription, setStudyImportDeckDescription] = useState("");
  const [studyImportDeckTags, setStudyImportDeckTags] = useState("");
  const [studyImportDeckTitle, setStudyImportDeckTitle] = useState("");
  const [studyImportTargetMode, setStudyImportTargetMode] =
    useState<"existing" | "new">("new");
  const [studyImportPreview, setStudyImportPreview] =
    useState<StudyRichCsvImportPreviewResponse>();
  const [studyImportStatus, setStudyImportStatus] =
    useState<"idle" | "previewing" | "ready" | "saving" | "saved">("idle");
  const [studyImportError, setStudyImportError] = useState<string>();
  const [studyImportColumnMapping, setStudyImportColumnMapping] =
    useState<StudyRichCsvColumnMapping>(buildStudyRichCsvDefaultColumnMapping);

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
  const previewManifest = sourcePackPreview?.manifest ?? sourcePackManifest;
  const previewChunks = sourcePackPreview?.chunks ?? sourcePackChunkCandidates;
  const previewVisualCandidates =
    sourcePackPreview?.visualCandidates ?? sourcePackVisualCandidates;
  const detectedStudyImportHeaders = useMemo(() => {
    const previewHeaders = studyImportPreview?.csvHeaders ?? [];
    const pastedHeaders = detectStudyRichCsvHeaders(studyImportPrepInput).headers;
    return previewHeaders.length > 0 ? previewHeaders : pastedHeaders;
  }, [studyImportPrepInput, studyImportPreview?.csvHeaders]);
  const mappedStudyImportFields = useMemo(
    () =>
      studyRichCsvSkillHeaders.filter((field) => {
        const header = studyImportColumnMapping[field]?.trim();
        return Boolean(header && detectedStudyImportHeaders.includes(header));
      }),
    [detectedStudyImportHeaders, studyImportColumnMapping],
  );
  const missingRequiredStudyImportFields = useMemo(
    () =>
      studyRichCsvRequiredFields.filter((field) => {
        const header = studyImportColumnMapping[field]?.trim();
        return !header || !detectedStudyImportHeaders.includes(header);
      }),
    [detectedStudyImportHeaders, studyImportColumnMapping],
  );

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

  function handleWorkspaceSectionChange(nextSection: ContentStudioWorkspaceSection) {
    setWorkspaceSection(nextSection);

    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    if (nextSection === "overview") {
      url.searchParams.delete("contentStudioWorkspace");
    } else {
      url.searchParams.set("contentStudioWorkspace", nextSection);
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
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

  async function handlePreviewSourcePack() {
    if (!sourcePackPreviewInput.trim()) {
      setSourcePackPreviewError("Paste a source-pack review bundle JSON payload first.");
      return;
    }

    setSourcePackPreviewStatus("previewing");
    setSourcePackPreviewError(undefined);

    try {
      const parsedPayload = JSON.parse(sourcePackPreviewInput) as unknown;
      const response = await fetch("/api/admin/content-studio/source-pack-preview", {
        body: JSON.stringify(parsedPayload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as SourcePackPreviewResponse;

      if (!response.ok || !body.manifest || !body.chunks || !body.visualCandidates) {
        throw new Error(body.error || "Source-pack preview failed.");
      }

      setSourcePackPreview(body);
      setSourcePackPreviewVersion((current) => current + 1);
      setSourcePackPreviewStatus("ready");
    } catch (previewError) {
      setSourcePackPreviewStatus("idle");
      setSourcePackPreviewError(
        previewError instanceof SyntaxError
          ? "Source-pack preview payload must be valid JSON."
          : previewError instanceof Error
            ? previewError.message
            : "Source-pack preview failed.",
      );
    }
  }

  async function handlePreviewProductPacket() {
    if (!productPacketInput.trim()) {
      setProductPacketPreviewError("Paste a product packet JSON payload first.");
      return;
    }

    setProductPacketPreviewStatus("previewing");
    setProductPacketPreviewError(undefined);
    setProductPacketValidationErrors([]);

    try {
      const parsedPayload = JSON.parse(productPacketInput) as unknown;
      if (productPacketKind === "study_deck_draft") {
        const draftResponse = await fetch("/api/study/content-studio/flashcard-draft", {
          body: JSON.stringify({
            mode: "source_pack_preview",
            sourcePackDraftJson: parsedPayload,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const draftBody = (await draftResponse.json()) as StudyDeckDraftPreviewResponse;
        const draftValidationErrors = Array.isArray(draftBody.validationErrors)
          ? draftBody.validationErrors
          : [];

        if (!draftResponse.ok) {
          setProductPacketValidationErrors(draftValidationErrors);
          throw new Error(draftBody.error || "Study deck draft preview failed.");
        }

        const queueResponse = await fetch("/api/study/content-studio/flashcard-draft", {
          body: JSON.stringify({
            mode: "source_pack_verification_queue_preview",
            sourcePackDraftJson: parsedPayload,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const queueBody = (await queueResponse.json()) as StudyVerificationQueuePreviewResponse;
        const queueValidationErrors = Array.isArray(queueBody.validationErrors)
          ? queueBody.validationErrors
          : [];

        if (!queueResponse.ok) {
          setProductPacketValidationErrors(queueValidationErrors);
          throw new Error(queueBody.error || "Study verification queue preview failed.");
        }

        setProductPacketPreview({
          deckDraftPreview: draftBody,
          verificationQueuePreview: queueBody,
        });
        setProductPacketValidationErrors([
          ...draftValidationErrors,
          ...queueValidationErrors,
        ]);
        setProductPacketPreviewStatus("ready");
        return;
      }

      const endpoint =
        productPacketKind === "study_generation"
          ? "/api/study/content-studio/flashcard-draft"
          : "/api/dpe/content/draft";
      const requestBody =
        productPacketKind === "study_generation"
          ? {
              generationPacketJson: parsedPayload,
              mode: "source_pack_generation_packet_preview",
            }
          : {
              mode: "source_pack_reference_packet_preview",
              referencePacket: parsedPayload,
            };
      const response = await fetch(endpoint, {
        body: JSON.stringify(requestBody),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as ProductPacketPreviewResponse;
      const validationErrors =
        "validationErrors" in body && Array.isArray(body.validationErrors)
          ? body.validationErrors
          : [];

      if (!response.ok) {
        setProductPacketValidationErrors(validationErrors);
        throw new Error(body.error || "Product packet preview failed.");
      }

      setProductPacketPreview(body);
      setProductPacketValidationErrors(validationErrors);
      setProductPacketPreviewStatus("ready");
    } catch (previewError) {
      setProductPacketPreviewStatus("idle");
      setProductPacketPreviewError(
        previewError instanceof SyntaxError
          ? "Product packet payload must be valid JSON."
          : previewError instanceof Error
            ? previewError.message
            : "Product packet preview failed.",
      );
    }
  }

  async function handlePreviewStudyRichCsvImport() {
    if (!studyImportPrepInput.trim()) {
      setStudyImportError("Paste a rich flashcard CSV payload first.");
      return;
    }

    setStudyImportStatus("previewing");
    setStudyImportError(undefined);
    setStudyImportPreview(undefined);

    try {
      const response = await fetch("/api/study/content-studio/flashcard-draft", {
        body: JSON.stringify({
          columnMapping: studyImportColumnMapping,
          csvText: studyImportPrepInput,
          mode: "rich_csv_import_preview",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as StudyRichCsvImportPreviewResponse;

      if (!response.ok) {
        throw new Error(body.error || "Rich CSV preview failed.");
      }

      setStudyImportPreview(body);
      setStudyImportStatus("ready");
    } catch (previewError) {
      setStudyImportStatus("idle");
      setStudyImportError(
        previewError instanceof Error
          ? previewError.message
          : "Rich CSV preview failed.",
      );
    }
  }

  async function handleSaveStudyRichCsvImport() {
    if (studyImportTargetMode === "existing" && !studyImportDeckId.trim()) {
      setStudyImportError("Enter the target Study deck id before importing.");
      return;
    }
    if (studyImportTargetMode === "new" && !studyImportDeckTitle.trim()) {
      setStudyImportError("Enter a Study deck title before importing.");
      return;
    }
    if (!studyImportPrepInput.trim()) {
      setStudyImportError("Paste a rich flashcard CSV payload first.");
      return;
    }

    setStudyImportStatus("saving");
    setStudyImportError(undefined);

    try {
      const createDeckTags = studyImportDeckTags
        .split(/[|,]/)
        .map((tag) => tag.trim())
        .filter(Boolean);
      const response = await fetch("/api/study/content-studio/flashcard-draft", {
        body: JSON.stringify({
          columnMapping: studyImportColumnMapping,
          createDeckDescription:
            studyImportTargetMode === "new" ? studyImportDeckDescription.trim() || undefined : undefined,
          createDeckTags: studyImportTargetMode === "new" ? createDeckTags : undefined,
          createDeckTitle: studyImportTargetMode === "new" ? studyImportDeckTitle.trim() : undefined,
          csvText: studyImportPrepInput,
          deckId: studyImportTargetMode === "existing" ? studyImportDeckId.trim() : undefined,
          mode: "rich_csv_import_save",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as StudyRichCsvImportPreviewResponse;

      if (!response.ok) {
        throw new Error(body.error || "Rich CSV import failed.");
      }

      setStudyImportPreview(body);
      setStudyImportStatus("saved");
    } catch (saveError) {
      setStudyImportStatus("ready");
      setStudyImportError(
        saveError instanceof Error
          ? saveError.message
          : "Rich CSV import failed.",
      );
    }
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

      <div className="component-tabs" aria-label="Content Studio workspace sections">
        <button
          className={workspaceSection === "overview" ? "active" : undefined}
          onClick={() => handleWorkspaceSectionChange("overview")}
          type="button"
        >
          <History size={18} />
          Overview / Run history
        </button>
        <button
          className={workspaceSection === "source_review" ? "active" : undefined}
          onClick={() => handleWorkspaceSectionChange("source_review")}
          type="button"
        >
          <Images size={18} />
          Source review
        </button>
        <button
          className={workspaceSection === "product_packet" ? "active" : undefined}
          onClick={() => handleWorkspaceSectionChange("product_packet")}
          type="button"
        >
          <ShieldCheck size={18} />
          Product packet preview
        </button>
        <button
          className={workspaceSection === "study_import_prep" ? "active" : undefined}
          onClick={() => handleWorkspaceSectionChange("study_import_prep")}
          type="button"
        >
          <UploadCloud size={18} />
          Study import prep
        </button>
        <button
          className={workspaceSection === "draft_review" ? "active" : undefined}
          onClick={() => handleWorkspaceSectionChange("draft_review")}
          type="button"
        >
          <FileText size={18} />
          Draft review
        </button>
      </div>

      {workspaceSection === "overview" && (
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
      )}

      {workspaceSection === "draft_review" && draftRun && (
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

      {workspaceSection === "draft_review" && !draftRun && (
        <section className="prompt-version-list" aria-label="Draft review status">
          <div className="runtime-context-panel">
            <p>No draft is selected. Open a run from history to review draft details.</p>
          </div>
        </section>
      )}

      {workspaceSection === "source_review" && (
      <section className="prompt-version-list" aria-labelledby="source-pack-preview-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">Preview API boundary</p>
            <h3 id="source-pack-preview-title">Paste source-pack bundle JSON</h3>
            <p>
              Preview normalizes pasted JSON through an admin-only endpoint. It does
              not read files, call Drive, save review state, import product content,
              or publish anything.
            </p>
          </div>
          <FileText size={20} aria-hidden="true" />
        </div>

        <div className="field-grid">
          <label>
            <span>Review bundle JSON</span>
            <textarea
              onChange={(event) => setSourcePackPreviewInput(event.target.value)}
              placeholder="Paste a source-pack review bundle with manifest, chunks, figures, and tables."
              value={sourcePackPreviewInput}
            />
          </label>
        </div>

        {sourcePackPreviewError && (
          <div className="form-error" role="alert">
            {sourcePackPreviewError}
          </div>
        )}

        {sourcePackPreview?.validationErrors &&
          sourcePackPreview.validationErrors.length > 0 && (
            <div className="runtime-context-panel">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>Validation notes</strong>
                <ul>
                  {sourcePackPreview.validationErrors.map((validationError) => (
                    <li key={validationError}>{validationError}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

        <div className="component-tabs" aria-label="Source-pack preview actions">
          <button
            disabled={sourcePackPreviewStatus === "previewing"}
            onClick={() => void handlePreviewSourcePack()}
            type="button"
          >
            <Eye size={18} />
            {sourcePackPreviewStatus === "previewing"
              ? "Previewing"
              : sourcePackPreviewStatus === "ready"
                ? "Preview refreshed"
                : "Preview bundle"}
          </button>
          <button
            onClick={() => {
              setSourcePackPreviewInput(sourcePackPreviewSample);
              setSourcePackPreviewError(undefined);
            }}
            type="button"
          >
            <FileText size={18} />
            Load sample JSON
          </button>
          <button disabled type="button">
            <ShieldCheck size={18} />
            Save review disabled
          </button>
        </div>

        {sourcePackPreview?.storage?.detail && (
          <div className="form-note">{sourcePackPreview.storage.detail}</div>
        )}
      </section>
      )}

      {workspaceSection === "source_review" && (
      <SourcePackReviewScaffold
        chunks={previewChunks}
        key={`${previewManifest.id}-${sourcePackPreviewVersion}`}
        manifest={previewManifest}
        onSavedRun={(body) => {
          if (body.run) {
            selectDraftRun(body.run);
          }
          setRunHistory((current) =>
            body.runs ?? (body.run ? [body.run, ...current.filter((run) => run.id !== body.run?.id)] : current),
          );
          setStorageDetail(body.storage?.detail);
          setStatus("draft_ready");
        }}
        visualCandidates={previewVisualCandidates}
      />
      )}

      {workspaceSection === "product_packet" && (
      <section className="prompt-version-list" aria-labelledby="product-packet-preview-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">Preview-only bridge</p>
            <h3 id="product-packet-preview-title">Product packet preview</h3>
            <p>
              Paste Codex-generated product packet JSON and preview the product
              backend normalization. This does not import decks, write DPE
              references, load Drive/files, publish, or mark Official/Verified.
            </p>
          </div>
          <ShieldCheck size={20} aria-hidden="true" />
        </div>

        <div className="field-grid">
          <label>
            <span>Packet type</span>
            <select
              onChange={(event) => {
                const nextKind = event.target.value as ProductPacketPreviewKind;
                setProductPacketKind(nextKind);
                setProductPacketInput("");
                setProductPacketPreview(undefined);
                setProductPacketPreviewError(undefined);
                setProductPacketValidationErrors([]);
                setProductPacketPreviewStatus("idle");
              }}
              value={productPacketKind}
            >
              <option value="study_generation">Study generation packet</option>
              <option value="study_deck_draft">Study deck draft</option>
              <option value="dpe_reference">DPE reference packet</option>
            </select>
          </label>
          <label>
            <span>Product packet JSON</span>
            <textarea
              onChange={(event) => setProductPacketInput(event.target.value)}
              placeholder={
                productPacketKind === "study_generation"
                  ? "Paste a Study generation packet JSON payload."
                  : productPacketKind === "study_deck_draft"
                    ? "Paste a Study source-pack deck draft JSON payload."
                  : "Paste a DPE reference packet JSON payload."
              }
              value={productPacketInput}
            />
          </label>
        </div>

        {productPacketPreviewError && (
          <div className="form-error" role="alert">
            {productPacketPreviewError}
          </div>
        )}

        {productPacketValidationErrors.length > 0 && (
          <div className="runtime-context-panel">
            <AlertCircle size={18} aria-hidden="true" />
            <div>
              <strong>Validation errors</strong>
              <ul>
                {productPacketValidationErrors.map((validationError) => (
                  <li key={validationError}>{validationError}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="component-tabs" aria-label="Product packet preview actions">
          <button
            disabled={productPacketPreviewStatus === "previewing"}
            onClick={() => void handlePreviewProductPacket()}
            type="button"
          >
            <Eye size={18} />
            {productPacketPreviewStatus === "previewing"
              ? "Previewing"
              : productPacketPreviewStatus === "ready"
                ? "Preview refreshed"
                : "Preview packet"}
          </button>
          <button
            onClick={() => {
              setProductPacketInput(
                productPacketKind === "study_generation"
                  ? studyGenerationPacketPreviewSample
                  : productPacketKind === "study_deck_draft"
                    ? studyDeckDraftPreviewSample
                    : dpeReferencePacketPreviewSample,
              );
              setProductPacketPreviewError(undefined);
              setProductPacketValidationErrors([]);
            }}
            type="button"
          >
            <FileText size={18} />
            Load sample JSON
          </button>
          <button disabled type="button">
            <CheckCircle2 size={18} />
            Product import disabled
          </button>
        </div>

        {productPacketPreview && (
          <ProductPacketPreviewPanel
            kind={productPacketKind}
            preview={productPacketPreview}
          />
        )}
      </section>
      )}

      {workspaceSection === "study_import_prep" && (
        <section className="prompt-version-list" aria-labelledby="study-import-prep-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">Admin import workflow</p>
              <h3 id="study-import-prep-title">Rich flashcard CSV import</h3>
              <p>
                Prepare rich Study import payloads with source and verification metadata.
                Preview validates the CSV before any cards are written to a target deck.
              </p>
            </div>
            <UploadCloud size={20} aria-hidden="true" />
          </div>

          <div className="study-stat-strip" aria-label="Rich CSV import prep status">
            <div className="study-stat-chip">
              <strong>Preview</strong>
              <span>{studyImportStatus === "previewing" ? "Checking CSV" : "Backend validation"}</span>
            </div>
            <div className="study-stat-chip">
              <strong>{studyImportPreview?.rowCount ?? 0}</strong>
              <span>Validated rows</span>
            </div>
            <div className="study-stat-chip highlight">
              <strong>{studyImportStatus === "saved" ? "Saved" : "Guarded"}</strong>
              <span>Deck import only</span>
            </div>
          </div>

          <div className="runtime-context-panel">
            <strong>Expected rich CSV fields</strong>
            <div className="question-meta">
              {studyRichCsvSkillHeaders.map((field) => (
                <span className="pill" key={field}>
                  {field}
                </span>
              ))}
            </div>
          </div>

          <div className="field-grid">
            <label>
              <span>Rich flashcard CSV</span>
              <textarea
                onChange={(event) => setStudyImportPrepInput(event.target.value)}
                placeholder="Paste rich flashcard CSV rows for preview validation."
                value={studyImportPrepInput}
              />
            </label>
          </div>

          <div className="runtime-context-panel">
            <div className="section-head">
              <div>
                <strong>Column mapping</strong>
                <p>
                  Map detected CSV headers to Study rich import fields. Defaults align
                  with the Codex rich CSV exporter.
                </p>
              </div>
              <span className="pill">{mappedStudyImportFields.length}/{studyRichCsvSkillHeaders.length} mapped</span>
            </div>

            <div className="question-meta">
              {detectedStudyImportHeaders.length > 0 ? (
                detectedStudyImportHeaders.map((header) => (
                  <span className="pill" key={header}>
                    {header}
                  </span>
                ))
              ) : (
                <span className="pill">No headers detected yet</span>
              )}
            </div>

            <div className="field-grid">
              {studyRichCsvSkillHeaders.map((field) => (
                <label key={field}>
                  <span>{field}</span>
                  <select
                    onChange={(event) =>
                      setStudyImportColumnMapping((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                    value={studyImportColumnMapping[field] ?? ""}
                  >
                    <option value="">Unmapped</option>
                    {Array.from(
                      new Set([...detectedStudyImportHeaders, ...studyRichCsvSkillHeaders]),
                    ).map((header) => (
                      <option key={`${field}-${header}`} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div className="component-tabs" aria-label="Study rich CSV mapping actions">
              <button
                onClick={() =>
                  setStudyImportColumnMapping(buildStudyRichCsvDefaultColumnMapping())
                }
                type="button"
              >
                <FileText size={18} />
                Reset to skill defaults
              </button>
              <button
                onClick={() =>
                  setStudyImportColumnMapping((current) =>
                    studyRichCsvSkillHeaders.reduce<StudyRichCsvColumnMapping>((mapping, field) => {
                      const preferred = detectedStudyImportHeaders.find((header) => header === field) ?? "";
                      mapping[field] = preferred || current[field] || field;
                      return mapping;
                    }, { ...current }),
                  )
                }
                type="button"
              >
                <CheckCircle2 size={18} />
                Match detected headers
              </button>
            </div>

            {missingRequiredStudyImportFields.length > 0 && (
              <div className="form-note">
                Required fields missing from mapping: {missingRequiredStudyImportFields.join(", ")}
              </div>
            )}
          </div>

          <div className="runtime-context-panel">
            <strong>Study deck target</strong>
            <div className="component-tabs" aria-label="Study rich CSV deck target">
              <button
                className={studyImportTargetMode === "new" ? "active" : undefined}
                onClick={() => setStudyImportTargetMode("new")}
                type="button"
              >
                <UploadCloud size={18} />
                Create new deck
              </button>
              <button
                className={studyImportTargetMode === "existing" ? "active" : undefined}
                onClick={() => setStudyImportTargetMode("existing")}
                type="button"
              >
                <FileText size={18} />
                Use existing deck
              </button>
            </div>
            {studyImportTargetMode === "new" ? (
              <div className="field-grid">
                <label>
                  <span>New Study deck title</span>
                  <input
                    onChange={(event) => setStudyImportDeckTitle(event.target.value)}
                    placeholder="Example: PHAK Aeronautical Decision Making"
                    value={studyImportDeckTitle}
                  />
                </label>
                <label>
                  <span>Deck description</span>
                  <input
                    onChange={(event) => setStudyImportDeckDescription(event.target.value)}
                    placeholder="Optional reviewer-facing deck description"
                    value={studyImportDeckDescription}
                  />
                </label>
                <label>
                  <span>Deck tags</span>
                  <input
                    onChange={(event) => setStudyImportDeckTags(event.target.value)}
                    placeholder="Separate tags with commas"
                    value={studyImportDeckTags}
                  />
                </label>
              </div>
            ) : (
              <div className="field-grid">
            <label>
              <span>Target Study deck id</span>
              <input
                onChange={(event) => setStudyImportDeckId(event.target.value)}
                placeholder="Paste the Study deck UUID for approved import"
                value={studyImportDeckId}
              />
            </label>
              </div>
            )}
          </div>

          {studyImportError && (
            <div className="form-error" role="alert">
              {studyImportError}
            </div>
          )}

          <div className="component-tabs" aria-label="Rich CSV import prep actions">
            <button
              disabled={studyImportStatus === "previewing" || studyImportStatus === "saving"}
              onClick={() => void handlePreviewStudyRichCsvImport()}
              type="button"
            >
              <Eye size={18} />
              {studyImportStatus === "previewing"
                ? "Previewing CSV"
                : studyImportStatus === "ready" || studyImportStatus === "saved"
                  ? "Preview refreshed"
                  : "Preview rich CSV"}
            </button>
            <button
              onClick={() => {
                setStudyImportPrepInput(studyRichCsvPreviewSample);
                setStudyImportDeckDescription("Imported through Admin Content Studio rich CSV.");
                setStudyImportDeckTags("content-studio,rich-csv");
                setStudyImportDeckTitle("Rich CSV Sample Import");
                setStudyImportError(undefined);
              }}
              type="button"
            >
              <FileText size={18} />
              Load sample CSV
            </button>
            <button
              disabled={
                studyImportStatus === "previewing" ||
                studyImportStatus === "saving" ||
                !studyImportPreview ||
                (studyImportPreview.validationErrors?.length ?? 0) > 0 ||
                missingRequiredStudyImportFields.length > 0
              }
              onClick={() => void handleSaveStudyRichCsvImport()}
              type="button"
            >
              <CheckCircle2 size={18} />
              {studyImportStatus === "saving"
                ? "Importing"
                : studyImportStatus === "saved"
                  ? "Import saved"
                  : studyImportTargetMode === "new"
                    ? "Create deck and import"
                    : "Import to deck"}
            </button>
          </div>

          {studyImportPreview && (
            <StudyRichCsvImportPreviewPanel preview={studyImportPreview} />
          )}

          <div className="runtime-context-panel">
            <strong>Guardrails</strong>
            <p>
              Reviewed source-pack decisions {"->"} Codex generation tools {"->"} rich CSV preview
              (`rich_csv_import_preview`) {"->"} approved Study deck import.
            </p>
            <div className="question-meta">
              <span className="pill">No Drive loading</span>
              <span className="pill">No runtime source-pack reads</span>
              <span className="pill">No DPE runtime writes</span>
              <span className="pill">No Publish / Official writes</span>
              <span className="pill">Conservative Verified policy</span>
            </div>
          </div>
        </section>
      )}

      {workspaceSection === "overview" && (
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
      )}

      {workspaceSection === "overview" && (
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
                    <strong>{contentStudioRunLabel(run)}</strong>
                    <p>{formatDate(run.completedAt ?? run.createdAt)}</p>
                  </div>
                  <span>{statusLabel(run.status)}</span>
                </div>
                <div className="question-meta">
                  <span className="pill">{run.templateKey}</span>
                  {run.pipelineKey === "study_flashcards" && (
                    <span className="pill">{cardCount(run) ?? 0} cards</span>
                  )}
                  {isSourcePackReviewExportRun(run) && (
                    <span className="pill">review export artifact</span>
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
      )}
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

const sourcePackReviewDecisionOptions: SourcePackReviewDecision[] = [
  "candidate",
  "accepted",
  "needs_edit",
  "reject",
  "keep",
];

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

function buildSourcePackReviewExport(args: {
  chunks: SourcePackChunkCandidate[];
  manifest: SourcePackManifest;
  reviewRun: SourcePackReviewRun;
  visualCandidates: SourcePackVisualReviewCandidate[];
}) {
  const acceptedChunks = args.chunks.filter(
    (chunk) => sourcePackReviewBucket(chunk.reviewDecision) === "accepted",
  );
  const reviewedVisuals = args.visualCandidates.filter(
    (candidate) => candidate.reviewDecision !== "candidate",
  );
  const acceptedVisuals = args.visualCandidates.filter(
    (candidate) => sourcePackReviewBucket(candidate.reviewDecision) === "accepted",
  );

  return {
    acceptedChunkIds: acceptedChunks.map((chunk) => chunk.chunkId),
    acceptedVisualIds: acceptedVisuals.map((candidate) => candidate.id),
    manifest: {
      id: args.manifest.id,
      sourceIds: args.manifest.sourceIds,
      title: args.manifest.title,
    },
    notes: args.reviewRun.decisions
      .filter((decision) => decision.reviewerNotes)
      .map((decision) => ({
        candidateId: decision.candidateId,
        candidateType: decision.candidateType,
        note: decision.reviewerNotes,
      })),
    restrictions: [
      "admin_review_export_preview_only",
      "no_drive_loading",
      "durable_admin_artifact_only",
      "no_product_import",
      "no_publish_official_or_verified_write",
      "study_generation_first_dpe_later",
    ],
    reviewCounts: args.reviewRun.reviewCounts,
    reviewRunId: args.reviewRun.id,
    reviewedVisualIds: reviewedVisuals.map((candidate) => candidate.id),
    sourceAnchors: args.reviewRun.decisions.map((decision) => ({
      candidateId: decision.candidateId,
      candidateType: decision.candidateType,
      sourceAnchor: decision.sourceAnchor,
      sourceId: decision.sourceId,
    })),
    stage: "source_pack_admin_review_export_preview",
  };
}

function SourcePackReviewScaffold({
  chunks,
  manifest,
  onSavedRun,
  visualCandidates,
}: {
  chunks: SourcePackChunkCandidate[];
  manifest: SourcePackManifest;
  onSavedRun: (body: RunsResponse) => void;
  visualCandidates: SourcePackVisualReviewCandidate[];
}) {
  const [activeTab, setActiveTab] = useState<SourcePackReviewTab>("chunks");
  const [decisionFilter, setDecisionFilter] = useState<SourcePackReviewDecision | "all">(
    "all",
  );
  const [localChunks, setLocalChunks] = useState(chunks);
  const [localVisualCandidates, setLocalVisualCandidates] =
    useState(visualCandidates);
  const [exportSaveStatus, setExportSaveStatus] = useState<SaveReviewStatus>("idle");
  const [exportSaveError, setExportSaveError] = useState<string>();
  const [savedExportRunId, setSavedExportRunId] = useState<string>();

  const reviewRun = useMemo(
    () =>
      buildSourcePackReviewRun({
        chunks: localChunks,
        manifest,
        visualCandidates: localVisualCandidates,
      }),
    [localChunks, manifest, localVisualCandidates],
  );
  const reviewExport = useMemo(
    () =>
      buildSourcePackReviewExport({
        chunks: localChunks,
        manifest,
        reviewRun,
        visualCandidates: localVisualCandidates,
      }),
    [localChunks, manifest, reviewRun, localVisualCandidates],
  );
  const reviewExportJson = useMemo(
    () => JSON.stringify(reviewExport, null, 2),
    [reviewExport],
  );
  const figures = localVisualCandidates.filter((candidate) => candidate.type === "figure");
  const tables = localVisualCandidates.filter((candidate) => candidate.type === "table");
  const filteredChunks = localChunks.filter(
    (candidate) =>
      decisionFilter === "all" || candidate.reviewDecision === decisionFilter,
  );
  const filteredVisuals = (activeTab === "figures" ? figures : tables).filter(
    (candidate) =>
      decisionFilter === "all" || candidate.reviewDecision === decisionFilter,
  );

  function updateChunkReview(
    chunkId: string,
    changes: Partial<Pick<SourcePackChunkCandidate, "reviewDecision" | "reviewNotes">>,
  ) {
    setExportSaveStatus("idle");
    setSavedExportRunId(undefined);
    setLocalChunks((current) =>
      current.map((chunk) =>
        chunk.chunkId === chunkId ? { ...chunk, ...changes } : chunk,
      ),
    );
  }

  function updateVisualReview(
    candidateId: string,
    changes: Partial<
      Pick<SourcePackVisualReviewCandidate, "reviewDecision" | "reviewNotes">
    >,
  ) {
    setExportSaveStatus("idle");
    setSavedExportRunId(undefined);
    setLocalVisualCandidates((current) =>
      current.map((candidate) =>
        candidate.id === candidateId ? { ...candidate, ...changes } : candidate,
      ),
    );
  }

  async function handleSaveReviewExport() {
    setExportSaveStatus("saving");
    setExportSaveError(undefined);

    try {
      const response = await fetch("/api/admin/content-studio/source-pack-review-runs", {
        body: JSON.stringify({ reviewExport }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as RunsResponse & {
        validationErrors?: string[];
      };

      if (!response.ok || !body.run) {
        throw new Error(
          body.validationErrors?.join(" ") ||
            body.error ||
            "Source-pack review export could not be saved.",
        );
      }

      setSavedExportRunId(body.run.id);
      setExportSaveStatus("saved");
      onSavedRun(body);
    } catch (saveError) {
      setExportSaveStatus("idle");
      setExportSaveError(
        saveError instanceof Error
          ? saveError.message
          : "Source-pack review export could not be saved.",
      );
    }
  }

  return (
    <section className="prompt-version-list" aria-labelledby="source-pack-visual-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Read-only source-pack review</p>
          <h3 id="source-pack-visual-title">Source Pack Review</h3>
          <p>
            Admin-side scaffold for source-pack manifests, chunk candidates,
            figures, and tables. This can save the export as a durable Admin
            artifact, but does not load Drive files, import product content, or
            publish anything.
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
          <strong>{localChunks.length}</strong>
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

      <div className="runtime-context-panel">
        <div className="section-head">
          <div>
            <strong>Export preview</strong>
            <p>
              Copyable local JSON for Codex-side Study draft generation tools.
              Saving stores this JSON as a Content Studio review artifact only;
              it does not call generation endpoints.
            </p>
          </div>
          <span className="pill">admin artifact</span>
        </div>
        <label>
          <span>Review run export JSON</span>
          <textarea readOnly value={reviewExportJson} />
        </label>
        <div className="component-tabs" aria-label="Source-pack review export actions">
          <button
            disabled={exportSaveStatus === "saving"}
            onClick={() => void handleSaveReviewExport()}
            type="button"
          >
            <CheckCircle2 size={18} />
            {exportSaveStatus === "saving"
              ? "Saving export"
              : exportSaveStatus === "saved"
                ? "Export saved"
                : "Save review export"}
          </button>
          <button disabled type="button">
            <ShieldCheck size={18} />
            Product import disabled
          </button>
        </div>
        {savedExportRunId && (
          <div className="form-note">Saved review artifact: {savedExportRunId}</div>
        )}
        {exportSaveError && (
          <div className="form-error" role="alert">
            {exportSaveError}
          </div>
        )}
      </div>

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
          <span className="pill">Review export save only</span>
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
            <ChunkCandidateCard
              candidate={candidate}
              key={candidate.chunkId}
              onReviewChange={updateChunkReview}
            />
          ))}
        {activeTab !== "chunks" &&
          filteredVisuals.map((candidate) => (
            <VisualCandidateCard
              candidate={candidate}
              key={candidate.id}
              onReviewChange={updateVisualReview}
            />
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

function isStudyGenerationPacketPreview(
  preview: ProductPacketPreviewResponse,
): preview is StudyGenerationPacketPreviewResponse {
  return "generationPacket" in preview || "reviewSections" in preview;
}

function isDpeReferencePacketPreview(
  preview: ProductPacketPreviewResponse,
): preview is DpeReferencePacketPreviewResponse {
  return "reviewSummary" in preview || "draftReferenceContract" in preview;
}

function isStudyDeckDraftPreview(
  preview: ProductPacketPreviewResponse,
): preview is StudyDeckDraftProductPacketPreviewResponse {
  return "deckDraftPreview" in preview || "verificationQueuePreview" in preview;
}

function StudyRichCsvImportPreviewPanel({
  preview,
}: {
  preview: StudyRichCsvImportPreviewResponse;
}) {
  const errors = preview.validationErrors ?? [];
  const warnings = preview.validationWarnings ?? [];
  const rows = preview.rows ?? [];
  const coverage = preview.sourceCoverage;

  return (
    <div className="runtime-context-panel">
      <div className="section-head">
        <div>
          <strong>
            {preview.richCsvImportSaved ? "Study import saved" : "Rich CSV preview"}
          </strong>
          <p>
            Source and verification metadata stays attached to the imported
            cards for reviewer traceability.
          </p>
        </div>
        <span className="pill">
          {preview.richCsvImportSaved ? "saved" : "preview only"}
        </span>
      </div>

      <div className="study-stat-strip" aria-label="Rich CSV import preview summary">
        <div className="study-stat-chip">
          <strong>{preview.rowCount ?? rows.length}</strong>
          <span>Rows</span>
        </div>
        <div className="study-stat-chip">
          <strong>{coverage?.uniqueChunkIds ?? 0}</strong>
          <span>Source chunks</span>
        </div>
        <div className="study-stat-chip">
          <strong>{coverage?.uniquePages ?? 0}</strong>
          <span>Pages</span>
        </div>
        <div className="study-stat-chip highlight">
          <strong>{coverage?.uniqueVisualAssetIds ?? 0}</strong>
          <span>Visuals</span>
        </div>
      </div>

      {preview.saveResult && (
        <div className="runtime-context-panel">
          <strong>Saved import</strong>
          <div className="question-meta">
            <span className="pill">Deck: {preview.saveResult.deckId}</span>
            <span className="pill">Import: {preview.saveResult.deckImportId}</span>
            <span className="pill">Cards: {preview.saveResult.createdCardCount}</span>
            <span className="pill">Sources: {preview.saveResult.createdSourceCount}</span>
            <span className="pill">
              Verifications: {preview.saveResult.createdVerificationCount}
            </span>
            <span className="pill">Verified: {preview.saveResult.verifiedCardCount}</span>
          </div>
        </div>
      )}

      {(errors.length > 0 || warnings.length > 0) && (
        <div className="runtime-context-panel">
          <strong>Validation notes</strong>
          <ul>
            {[...errors, ...warnings].map((issue, index) => (
              <li key={`${issue.row}-${issue.message}-${index}`}>
                Row {issue.row}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="runtime-context-panel">
        <strong>Verification status counts</strong>
        <div className="question-meta">
          {Object.entries(preview.verificationStatusCounts ?? {}).length > 0 ? (
            Object.entries(preview.verificationStatusCounts ?? {}).map(([status, count]) => (
              <span className="pill" key={status}>
                {status}: {count}
              </span>
            ))
          ) : (
            <span className="pill">No verification statuses supplied</span>
          )}
          {(coverage?.sourcePackIds ?? []).map((sourcePackId) => (
            <span className="pill" key={sourcePackId}>
              Source pack: {sourcePackId}
            </span>
          ))}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="question-list">
          {rows.slice(0, 5).map((row, index) => (
            <div
              className="runtime-context-panel"
              key={row.externalId ?? `${row.question}-${index}`}
            >
              <div className="section-head">
                <div>
                  <strong>{row.question}</strong>
                  <p>{row.answer}</p>
                </div>
                <span className="pill">{row.verification.status ?? "unverified"}</span>
              </div>
              <div className="question-meta">
                <span className="pill">
                  Chunks: {row.source.sourceChunkIds?.join(", ") || "none"}
                </span>
                <span className="pill">
                  Pages: {row.source.sourcePages?.join(", ") || "none"}
                </span>
                <span className="pill">
                  Visuals: {row.source.sourceVisualAssetIds?.join(", ") || "none"}
                </span>
                <span className="pill">Tags: {row.tags?.join(", ") || "none"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductPacketPreviewPanel({
  kind,
  preview,
}: {
  kind: ProductPacketPreviewKind;
  preview: ProductPacketPreviewResponse;
}) {
  if (kind === "study_generation" && isStudyGenerationPacketPreview(preview)) {
    return <StudyGenerationPacketPreviewPanel preview={preview} />;
  }

  if (kind === "study_deck_draft" && isStudyDeckDraftPreview(preview)) {
    return <StudyDeckDraftPacketPreviewPanel preview={preview} />;
  }

  if (kind === "dpe_reference" && isDpeReferencePacketPreview(preview)) {
    return <DpeReferencePacketPreviewPanel preview={preview} />;
  }

  return (
    <div className="runtime-context-panel">
      <p>Product packet preview returned an unexpected shape.</p>
    </div>
  );
}

function countQueueItemsByStatus(
  items: NonNullable<StudyVerificationQueuePreviewResponse["queuePreview"]>["queueItems"] | undefined,
) {
  const counts = {
    blocked: 0,
    queued: 0,
  };

  for (const item of items ?? []) {
    if (item.recommendedVerifierStatus === "queued_for_verifier") {
      counts.queued += 1;
    } else {
      counts.blocked += 1;
    }
  }

  return counts;
}

function StudyDeckDraftPacketPreviewPanel({
  preview,
}: {
  preview: StudyDeckDraftProductPacketPreviewResponse;
}) {
  const draft = preview.deckDraftPreview.draftContract?.draft;
  const draftReviewSections = preview.deckDraftPreview.reviewSections ?? [];
  const queue = preview.verificationQueuePreview.queuePreview;
  const queueReviewSections = preview.verificationQueuePreview.reviewSections ?? [];
  const queueCounts = countQueueItemsByStatus(queue?.queueItems);

  return (
    <div className="runtime-context-panel">
      <div className="section-head">
        <div>
          <strong>Study deck draft preview</strong>
          <p>
            Backend accepted the draft and verifier queue for preview only. No
            Study deck was imported and no verifier AI call was made.
          </p>
        </div>
        <span className="pill">preview only</span>
      </div>

      <div className="study-stat-strip" aria-label="Study deck draft summary">
        <div className="study-stat-chip">
          <strong>{draft?.sourcePackId ?? queue?.sourcePackId ?? "pending"}</strong>
          <span>Source pack</span>
        </div>
        <div className="study-stat-chip">
          <strong>{draft?.cards?.length ?? queue?.summary.cardCount ?? 0}</strong>
          <span>Cards</span>
        </div>
        <div className="study-stat-chip">
          <strong>{queueCounts.queued}</strong>
          <span>Queued</span>
        </div>
        <div className="study-stat-chip highlight">
          <strong>{queueCounts.blocked}</strong>
          <span>Blocked</span>
        </div>
      </div>

      <div className="runtime-context-panel">
        <strong>{draft?.title ?? queue?.summary.title ?? "Untitled draft"}</strong>
        <div className="question-meta">
          <span className="pill">Draft: {draft?.draftId ?? queue?.draftId ?? "pending"}</span>
          <span className="pill">Status: {draft?.verificationStatus ?? "pending"}</span>
          <span className="pill">Chunks: {queue?.summary.uniqueChunkIds ?? 0}</span>
          <span className="pill">Page anchors: {queue?.summary.pageAnchorsCount ?? 0}</span>
          <span className="pill">Visual assets: {queue?.summary.uniqueVisualAssetIds ?? 0}</span>
        </div>
      </div>

      <div className="runtime-context-panel">
        <strong>Warnings and card statuses</strong>
        <div className="question-meta">
          <span className="pill">Blockers: {queue?.summary.warningCounts.blocker ?? 0}</span>
          <span className="pill">Warnings: {queue?.summary.warningCounts.warning ?? 0}</span>
          <span className="pill">Info: {queue?.summary.warningCounts.info ?? 0}</span>
          {Object.entries(queue?.summary.verificationStatusCounts ?? {}).map(([status, count]) => (
            <span className="pill" key={status}>
              {status}: {count}
            </span>
          ))}
        </div>
      </div>

      <div className="question-list">
        {[...draftReviewSections, ...queueReviewSections].map((section) => (
          <div className="runtime-context-panel" key={section.title}>
            <strong>{section.title}</strong>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {queue?.queueItems.length ? (
        <div className="question-list">
          {queue.queueItems.slice(0, 3).map((item) => (
            <div className="runtime-context-panel" key={`${item.cardIndex}-${item.question}`}>
              <div className="section-head">
                <div>
                  <strong>
                    Card {item.cardIndex}: {item.recommendedVerifierAction.replaceAll("_", " ")}
                  </strong>
                  <p>{item.question}</p>
                </div>
                <span className="pill">{item.recommendedVerifierStatus.replaceAll("_", " ")}</span>
              </div>
              <div className="question-meta">
                <span className="pill">
                  Chunks: {item.sourceCitation?.chunkIds?.join(", ") || "none"}
                </span>
                <span className="pill">
                  Visuals: {item.sourceCitation?.visualAssetIds?.join(", ") || "none"}
                </span>
                <span className="pill">
                  Page anchors: {item.sourceCitation?.pageAnchors?.length ?? 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : undefined}
    </div>
  );
}

function StudyGenerationPacketPreviewPanel({
  preview,
}: {
  preview: StudyGenerationPacketPreviewResponse;
}) {
  const packet = preview.generationPacket;
  const sourcePack = packet?.sourcePack;
  const chunks = packet?.chunks ?? [];

  return (
    <div className="runtime-context-panel">
      <div className="section-head">
        <div>
          <strong>Study packet preview</strong>
          <p>
            Backend accepted the packet for preview only. No Study deck was
            created.
          </p>
        </div>
        <span className="pill">preview only</span>
      </div>

      <div className="study-stat-strip" aria-label="Study generation packet summary">
        <div className="study-stat-chip">
          <strong>{sourcePack?.sourcePackId ?? "pending"}</strong>
          <span>Source pack</span>
        </div>
        <div className="study-stat-chip">
          <strong>{chunks.length}</strong>
          <span>Chunks</span>
        </div>
        <div className="study-stat-chip">
          <strong>{packet?.deckRequest?.cardTarget ?? "--"}</strong>
          <span>Card target</span>
        </div>
        <div className="study-stat-chip highlight">
          <strong>{preview.reviewSections?.length ?? 0}</strong>
          <span>Review sections</span>
        </div>
      </div>

      <div className="question-list">
        {preview.reviewSections?.map((section) => (
          <div className="runtime-context-panel" key={section.title}>
            <strong>{section.title}</strong>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function DpeReferencePacketPreviewPanel({
  preview,
}: {
  preview: DpeReferencePacketPreviewResponse;
}) {
  const summary = preview.reviewSummary;
  const warnings = preview.draftReferenceContract?.warnings ?? [];
  const statusCounts = summary?.itemsByVerificationStatus ?? {};

  return (
    <div className="runtime-context-panel">
      <div className="section-head">
        <div>
          <strong>DPE reference packet preview</strong>
          <p>
            Backend accepted the reference packet for admin preview only. No DPE
            runtime data was written.
          </p>
        </div>
        <span className="pill">preview only</span>
      </div>

      <div className="study-stat-strip" aria-label="DPE reference packet summary">
        <div className="study-stat-chip">
          <strong>{summary?.itemCount ?? 0}</strong>
          <span>Items</span>
        </div>
        <div className="study-stat-chip">
          <strong>{summary?.sourceChunkCount ?? 0}</strong>
          <span>Source chunks</span>
        </div>
        <div className="study-stat-chip">
          <strong>{summary?.visualAssetCount ?? 0}</strong>
          <span>Visual assets</span>
        </div>
        <div className="study-stat-chip highlight">
          <strong>{summary?.trackApplicability.length ?? 0}</strong>
          <span>Tracks</span>
        </div>
      </div>

      <div className="runtime-context-panel">
        <strong>Source pack</strong>
        <div className="question-meta">
          <span className="pill">{summary?.sourcePack.id ?? "missing id"}</span>
          <span className="pill">{summary?.sourcePack.title ?? "missing title"}</span>
        </div>
      </div>

      <div className="runtime-context-panel">
        <strong>Verification status counts</strong>
        <div className="question-meta">
          {Object.entries(statusCounts).map(([status, count]) => (
            <span className="pill" key={status}>
              {status}: {count}
            </span>
          ))}
        </div>
      </div>

      <div className="runtime-context-panel">
        <strong>Track applicability</strong>
        <p>
          {summary?.trackApplicability.length
            ? summary.trackApplicability.join(", ")
            : "No track applicability returned."}
        </p>
      </div>

      {warnings.length > 0 && (
        <div className="runtime-context-panel">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <strong>Warnings</strong>
            <ul>
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function ChunkCandidateCard({
  candidate,
  onReviewChange,
}: {
  candidate: SourcePackChunkCandidate;
  onReviewChange: (
    chunkId: string,
    changes: Partial<Pick<SourcePackChunkCandidate, "reviewDecision" | "reviewNotes">>,
  ) => void;
}) {
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
        <div className="field-grid">
          <label>
            <span>Decision</span>
            <select
              onChange={(event) =>
                onReviewChange(candidate.chunkId, {
                  reviewDecision: event.target.value as SourcePackReviewDecision,
                })
              }
              value={candidate.reviewDecision}
            >
              {sourcePackReviewDecisionOptions.map((decision) => (
                <option key={decision} value={decision}>
                  {reviewDecisionLabel(decision)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Notes</span>
            <textarea
              onChange={(event) =>
                onReviewChange(candidate.chunkId, {
                  reviewNotes: event.target.value,
                })
              }
              placeholder="Add reviewer notes for this chunk."
              value={candidate.reviewNotes ?? ""}
            />
          </label>
        </div>
      </div>
    </article>
  );
}

function VisualCandidateCard({
  candidate,
  onReviewChange,
}: {
  candidate: SourcePackVisualReviewCandidate;
  onReviewChange: (
    candidateId: string,
    changes: Partial<
      Pick<SourcePackVisualReviewCandidate, "reviewDecision" | "reviewNotes">
    >,
  ) => void;
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
        <div className="field-grid">
          <label>
            <span>Decision</span>
            <select
              onChange={(event) =>
                onReviewChange(candidate.id, {
                  reviewDecision: event.target.value as SourcePackReviewDecision,
                })
              }
              value={candidate.reviewDecision}
            >
              {sourcePackReviewDecisionOptions.map((decision) => (
                <option key={decision} value={decision}>
                  {reviewDecisionLabel(decision)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Notes</span>
            <textarea
              onChange={(event) =>
                onReviewChange(candidate.id, {
                  reviewNotes: event.target.value,
                })
              }
              placeholder="Add reviewer notes for this visual candidate."
              value={candidate.reviewNotes ?? ""}
            />
          </label>
        </div>
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
          <h3 id="review-state-title">{contentStudioRunLabel(run)}</h3>
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
  if (isSourcePackReviewExportRun(run) && run.draft.sourcePackReviewExport) {
    const exportPayload = run.draft.sourcePackReviewExport;

    return (
      <section className="prompt-version-list" aria-labelledby="source-pack-artifact-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">Saved review artifact</p>
            <h3 id="source-pack-artifact-title">{run.draft.title}</h3>
            <p>{run.draft.description}</p>
          </div>
          <span>Preview only</span>
        </div>

        <div className="study-stat-strip" aria-label="Saved source-pack review export summary">
          <div className="study-stat-chip highlight">
            <strong>{exportPayload.reviewCounts.accepted}</strong>
            <span>Accepted</span>
          </div>
          <div className="study-stat-chip">
            <strong>{exportPayload.reviewCounts.needs_edit}</strong>
            <span>Needs edit</span>
          </div>
          <div className="study-stat-chip">
            <strong>{exportPayload.reviewCounts.rejected}</strong>
            <span>Rejected</span>
          </div>
          <div className="study-stat-chip">
            <strong>{exportPayload.reviewCounts.candidate}</strong>
            <span>Candidate</span>
          </div>
        </div>

        <div className="runtime-context-panel">
          <strong>{exportPayload.manifest.title}</strong>
          <div className="question-meta">
            <span className="pill">Pack: {exportPayload.manifest.id}</span>
            <span className="pill">Run: {exportPayload.reviewRunId}</span>
            <span className="pill">{exportPayload.acceptedChunkIds.length} accepted chunks</span>
            <span className="pill">{exportPayload.acceptedVisualIds.length} accepted visuals</span>
            <span className="pill">{exportPayload.reviewedVisualIds.length} reviewed visuals</span>
            <span className="pill">{exportPayload.notes.length} reviewer notes</span>
          </div>
          <p>
            Reopening currently shows the durable export artifact. Restoring the
            per-candidate editing controls from a saved artifact is a future
            follow-up.
          </p>
        </div>

        <label>
          <span>Saved review export JSON</span>
          <textarea readOnly value={JSON.stringify(exportPayload, null, 2)} />
        </label>
      </section>
    );
  }

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
