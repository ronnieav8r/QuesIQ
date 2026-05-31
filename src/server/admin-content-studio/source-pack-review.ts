export type SourcePackReviewDecision =
  | "accepted"
  | "candidate"
  | "keep"
  | "needs_edit"
  | "reject";

export type SourcePackReviewBucket =
  | "accepted"
  | "candidate"
  | "needs_edit"
  | "rejected";

export type SourcePackVisualStatus =
  | "cropped_candidate"
  | "cropped_reviewed"
  | "metadata_only"
  | "rendered_page";

export type SourcePackKeepRecommendation = "keep" | "review" | "skip";

export type NormalizedSourcePackManifest = {
  chunkCount: number;
  createdAt: string;
  figureCount: number;
  id: string;
  sourceCount: number;
  sourceIds: string[];
  tableCount: number;
  title: string;
};

export type NormalizedSourcePackChunkCandidate = {
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

export type NormalizedSourcePackVisualCandidate = {
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
  reviewAssetPath?: string;
  reviewDecision: SourcePackReviewDecision;
  reviewNotes?: string;
  reviewStatus: SourcePackVisualStatus;
  sourceExcerpt?: string;
  sourceId: string;
  sourceTitle: string;
  subject?: string;
  subtopics?: string[];
  tableLabel?: string;
  topic?: string;
  type: "figure" | "table";
  useCases?: string[];
};

export type SourcePackReviewDecisionRecord = {
  candidateId: string;
  candidateType: "chunk" | "figure" | "table";
  reviewBucket: SourcePackReviewBucket;
  reviewDecision: SourcePackReviewDecision;
  reviewedAssetIds: string[];
  reviewerNotes?: string;
  sourceAnchor: string;
  sourceId: string;
};

export type SourcePackReviewRun = {
  decisions: SourcePackReviewDecisionRecord[];
  id: string;
  manifestId: string;
  reviewCounts: Record<SourcePackReviewBucket, number>;
  stage: "admin_review_scaffold";
};

export type SourcePackPreviewResult = {
  chunks: NormalizedSourcePackChunkCandidate[];
  manifest: NormalizedSourcePackManifest;
  reviewRun: SourcePackReviewRun;
  validationErrors: string[];
  visualCandidates: NormalizedSourcePackVisualCandidate[];
};

const reviewDecisions: SourcePackReviewDecision[] = [
  "accepted",
  "candidate",
  "keep",
  "needs_edit",
  "reject",
];
const reviewStatuses: SourcePackVisualStatus[] = [
  "cropped_candidate",
  "cropped_reviewed",
  "metadata_only",
  "rendered_page",
];
const keepRecommendations: SourcePackKeepRecommendation[] = [
  "keep",
  "review",
  "skip",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeDecision(value: unknown): SourcePackReviewDecision {
  return reviewDecisions.includes(value as SourcePackReviewDecision)
    ? (value as SourcePackReviewDecision)
    : "candidate";
}

function normalizeVisualStatus(value: unknown): SourcePackVisualStatus {
  return reviewStatuses.includes(value as SourcePackVisualStatus)
    ? (value as SourcePackVisualStatus)
    : "metadata_only";
}

function normalizeKeepRecommendation(value: unknown): SourcePackKeepRecommendation {
  return keepRecommendations.includes(value as SourcePackKeepRecommendation)
    ? (value as SourcePackKeepRecommendation)
    : "review";
}

function normalizeBbox(value: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 4) {
    return undefined;
  }

  const values = value.map((item) => numberValue(item, Number.NaN));
  return values.every(Number.isFinite)
    ? (values as [number, number, number, number])
    : undefined;
}

export function sourcePackReviewBucket(
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

export function emptySourcePackReviewCounts(): Record<SourcePackReviewBucket, number> {
  return {
    accepted: 0,
    candidate: 0,
    needs_edit: 0,
    rejected: 0,
  };
}

export function countSourcePackReviewBuckets(
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

export function buildSourcePackReviewRun(args: {
  chunks: NormalizedSourcePackChunkCandidate[];
  manifest: NormalizedSourcePackManifest;
  visualCandidates: NormalizedSourcePackVisualCandidate[];
}): SourcePackReviewRun {
  const chunkDecisions =
    args.chunks.map<SourcePackReviewDecisionRecord>((chunk) => ({
      candidateId: chunk.chunkId,
      candidateType: "chunk",
      reviewBucket: sourcePackReviewBucket(chunk.reviewDecision),
      reviewDecision: chunk.reviewDecision,
      reviewedAssetIds: [...chunk.relatedFigureIds, ...chunk.relatedTableIds],
      reviewerNotes: chunk.reviewNotes,
      sourceAnchor: chunk.anchor,
      sourceId: chunk.sourceId,
    }));
  const visualDecisions =
    args.visualCandidates.map<SourcePackReviewDecisionRecord>((candidate) => ({
      candidateId: candidate.id,
      candidateType: candidate.type,
      reviewBucket: sourcePackReviewBucket(candidate.reviewDecision),
      reviewDecision: candidate.reviewDecision,
      reviewedAssetIds: [
        candidate.reviewAssetPath,
        candidate.assetPath,
        candidate.pageAssetPath,
      ].filter((value): value is string => Boolean(value)),
      reviewerNotes: candidate.reviewNotes,
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

function normalizeChunk(
  value: unknown,
  index: number,
  validationErrors: string[],
): NormalizedSourcePackChunkCandidate | undefined {
  if (!isRecord(value)) {
    validationErrors.push(`chunks[${index}] must be an object.`);
    return undefined;
  }

  const chunkId = stringValue(value.chunkId ?? value.id, `chunk-${index + 1}`);
  const sourceId = stringValue(value.sourceId, "unknown-source");
  const page = numberValue(value.page, 0);
  const excerpt = stringValue(value.excerpt ?? value.text ?? value.content);

  if (!excerpt) {
    validationErrors.push(`${chunkId} is missing excerpt/text content.`);
  }

  return {
    anchor: stringValue(value.anchor, `${sourceId}#page=${page}&chunk=${chunkId}`),
    chunkId,
    contextBefore: stringValue(value.contextBefore, undefined),
    excerpt: excerpt || "Excerpt missing.",
    page,
    relatedFigureIds: stringArray(value.relatedFigureIds ?? value.figureIds),
    relatedTableIds: stringArray(value.relatedTableIds ?? value.tableIds),
    reviewDecision: normalizeDecision(value.reviewDecision),
    reviewNotes: stringValue(value.reviewNotes, undefined),
    sourceId,
    sourceTitle: stringValue(value.sourceTitle ?? value.title, sourceId),
    subjects: stringArray(value.subjects ?? value.subject),
    tags: stringArray(value.tags),
    useCases: stringArray(value.useCases),
  };
}

function normalizeVisual(
  value: unknown,
  index: number,
  type: "figure" | "table",
  validationErrors: string[],
): NormalizedSourcePackVisualCandidate | undefined {
  if (!isRecord(value)) {
    validationErrors.push(`${type}s[${index}] must be an object.`);
    return undefined;
  }

  const id = stringValue(value.id, `${type}-${index + 1}`);
  const sourceId = stringValue(value.sourceId, "unknown-source");
  const page = numberValue(value.page, 0);

  if (!value.caption && !value.sourceExcerpt) {
    validationErrors.push(`${id} is missing caption or sourceExcerpt.`);
  }

  return {
    assetPath: stringValue(value.assetPath, undefined),
    bbox: normalizeBbox(value.bbox),
    caption: stringValue(value.caption, undefined),
    figureLabel: stringValue(value.figureLabel, undefined),
    id,
    instructionalValue: stringValue(value.instructionalValue, undefined),
    keepRecommendation: normalizeKeepRecommendation(value.keepRecommendation),
    page,
    pageAssetPath: stringValue(value.pageAssetPath, undefined),
    relatedChunkIds: stringArray(value.relatedChunkIds ?? value.chunkIds),
    reviewAssetPath: stringValue(value.reviewAssetPath, undefined),
    reviewDecision: normalizeDecision(value.reviewDecision),
    reviewNotes: stringValue(value.reviewNotes, undefined),
    reviewStatus: normalizeVisualStatus(value.reviewStatus),
    sourceExcerpt: stringValue(value.sourceExcerpt, undefined),
    sourceId,
    sourceTitle: stringValue(value.sourceTitle ?? value.title, sourceId),
    subject: stringValue(value.subject, undefined),
    subtopics: stringArray(value.subtopics),
    tableLabel: stringValue(value.tableLabel, undefined),
    topic: stringValue(value.topic, undefined),
    type,
    useCases: stringArray(value.useCases),
  };
}

export function normalizeSourcePackReviewBundle(payload: unknown): SourcePackPreviewResult {
  const validationErrors: string[] = [];
  const root = isRecord(payload) ? payload : {};

  if (!isRecord(payload)) {
    validationErrors.push("Payload must be a JSON object.");
  }

  const rawManifest = isRecord(root.manifest) ? root.manifest : {};
  const rawChunks = Array.isArray(root.chunks) ? root.chunks : [];
  const rawFigures = Array.isArray(root.figures) ? root.figures : [];
  const rawTables = Array.isArray(root.tables) ? root.tables : [];
  const rawVisualCandidates = Array.isArray(root.visualCandidates)
    ? root.visualCandidates
    : [];
  const chunks = rawChunks
    .slice(0, 200)
    .map((chunk, index) => normalizeChunk(chunk, index, validationErrors))
    .filter(
      (chunk): chunk is NormalizedSourcePackChunkCandidate => Boolean(chunk),
    );
  const figures = [...rawFigures, ...rawVisualCandidates.filter((candidate) =>
    isRecord(candidate) && candidate.type === "figure"
  )]
    .slice(0, 100)
    .map((figure, index) =>
      normalizeVisual(figure, index, "figure", validationErrors),
    )
    .filter(
      (candidate): candidate is NormalizedSourcePackVisualCandidate =>
        Boolean(candidate),
    );
  const tables = [...rawTables, ...rawVisualCandidates.filter((candidate) =>
    isRecord(candidate) && candidate.type === "table"
  )]
    .slice(0, 100)
    .map((table, index) => normalizeVisual(table, index, "table", validationErrors))
    .filter(
      (candidate): candidate is NormalizedSourcePackVisualCandidate =>
        Boolean(candidate),
    );
  const sourceIds = stringArray(rawManifest.sourceIds);
  const manifest: NormalizedSourcePackManifest = {
    chunkCount: chunks.length,
    createdAt: stringValue(rawManifest.createdAt, new Date(0).toISOString()),
    figureCount: figures.length,
    id: stringValue(rawManifest.id, "pasted-source-pack"),
    sourceCount: sourceIds.length || new Set([
      ...chunks.map((chunk) => chunk.sourceId),
      ...figures.map((figure) => figure.sourceId),
      ...tables.map((table) => table.sourceId),
    ]).size,
    sourceIds:
      sourceIds.length > 0
        ? sourceIds
        : Array.from(
            new Set([
              ...chunks.map((chunk) => chunk.sourceId),
              ...figures.map((figure) => figure.sourceId),
              ...tables.map((table) => table.sourceId),
            ]),
          ),
    tableCount: tables.length,
    title: stringValue(rawManifest.title, "Pasted source-pack review bundle"),
  };
  const visualCandidates = [...figures, ...tables];
  const reviewRun = buildSourcePackReviewRun({
    chunks,
    manifest,
    visualCandidates,
  });

  if (chunks.length + visualCandidates.length === 0) {
    validationErrors.push("Bundle must include at least one chunk, figure, or table.");
  }

  return {
    chunks,
    manifest,
    reviewRun,
    validationErrors,
    visualCandidates,
  };
}
