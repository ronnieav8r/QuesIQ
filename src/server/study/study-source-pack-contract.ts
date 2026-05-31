export type StudySourcePackCitation = {
  sourcePackId: string;
  sourceTitle?: string;
  pageEnd?: number;
  pageStart?: number;
  sourcePath?: string;
};

export type StudySourcePackReviewedChunk = {
  citation: StudySourcePackCitation;
  chunkId: string;
  reviewStatus: "accepted" | "needs_revision" | "ready_for_draft";
  sourceText: string;
  subject?: string;
  tags: string[];
  title?: string;
};

export type StudySourcePackReviewedVisualAsset = {
  assetId: string;
  assetType: "figure" | "page_crop" | "table";
  caption?: string;
  citation: StudySourcePackCitation;
  linkedChunkIds: string[];
  reviewStatus: "accepted" | "needs_revision" | "ready_for_draft";
  tags: string[];
};

export type StudySourcePackDraftDeck = {
  chunkIds: string[];
  deckKey: string;
  description: string;
  readiness: "blocked" | "draft_ready" | "needs_review";
  sourceCitations: StudySourcePackCitation[];
  sourcePackId: string;
  tags: string[];
  title: string;
  visualAssetIds: string[];
};

export type StudySourcePackDraftContract = {
  contractVersion: 1;
  draftDecks: StudySourcePackDraftDeck[];
  mode: "study_deck_draft_only";
  restrictions: {
    canMarkOfficial: false;
    canMarkVerified: false;
    canPublish: false;
    writesStudyDecks: false;
  };
};

const DRAFTABLE_STATUSES = new Set<StudySourcePackReviewedChunk["reviewStatus"]>(["accepted", "ready_for_draft"]);

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function sourcePackIdFor(chunks: StudySourcePackReviewedChunk[], assets: StudySourcePackReviewedVisualAsset[]) {
  return chunks[0]?.citation.sourcePackId || assets[0]?.citation.sourcePackId || "unknown-source-pack";
}

export function buildStudySourcePackDraftContract(args: {
  chunks: StudySourcePackReviewedChunk[];
  reviewedVisualAssets?: StudySourcePackReviewedVisualAsset[];
}): StudySourcePackDraftContract {
  const draftableChunks = args.chunks.filter((chunk) => DRAFTABLE_STATUSES.has(chunk.reviewStatus));
  const draftableAssets = (args.reviewedVisualAssets ?? []).filter((asset) => DRAFTABLE_STATUSES.has(asset.reviewStatus));
  const sourcePackId = sourcePackIdFor(args.chunks, args.reviewedVisualAssets ?? []);
  const grouped = new Map<string, StudySourcePackReviewedChunk[]>();

  for (const chunk of draftableChunks) {
    const deckKey = chunk.subject?.trim() || "General";
    grouped.set(deckKey, [...(grouped.get(deckKey) ?? []), chunk]);
  }

  return {
    contractVersion: 1,
    draftDecks: Array.from(grouped.entries()).map(([deckKey, chunks]) => {
      const chunkIds = chunks.map((chunk) => chunk.chunkId);
      const linkedAssets = draftableAssets.filter((asset) =>
        asset.linkedChunkIds.some((linkedChunkId) => chunkIds.includes(linkedChunkId)),
      );

      return {
        chunkIds,
        deckKey,
        description: `Draft Study deck assembled from reviewed ${sourcePackId} source-pack material.`,
        readiness: chunks.length > 0 ? "draft_ready" : "blocked",
        sourceCitations: chunks.map((chunk) => chunk.citation),
        sourcePackId,
        tags: unique(chunks.flatMap((chunk) => chunk.tags).concat(linkedAssets.flatMap((asset) => asset.tags))),
        title: `${deckKey} Draft Deck`,
        visualAssetIds: linkedAssets.map((asset) => asset.assetId),
      };
    }),
    mode: "study_deck_draft_only",
    restrictions: {
      canMarkOfficial: false,
      canMarkVerified: false,
      canPublish: false,
      writesStudyDecks: false,
    },
  };
}

export const STUDY_SOURCE_PACK_DRAFT_STATUS = {
  label: "Source-pack to deck draft",
  status: "Contract ready",
  summary: "Reviewed chunks and visual assets can be represented as draft deck inputs with citations and tags preserved.",
  templateKey: "study.sourcePackDeckDraft.v1",
} as const;
