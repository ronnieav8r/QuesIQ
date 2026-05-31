import type { StudySourcePackGeneratedDeckDraftContract } from "@/server/study/study-source-pack-draft-contract";
import type { StudySourcePackVerificationQueuePreview } from "@/server/study/study-source-pack-verification-queue";

type StudyDraftCardForRun = {
  answer: string;
  confidence: number;
  hint?: string;
  level: "advanced" | "beginner" | "intermediate";
  question: string;
  sourceNotes?: string;
  sourcePackCitation?: {
    chunkIds: string[];
    pageAnchors: Array<{
      page: number;
      x1?: number;
      x2?: number;
      y1?: number;
      y2?: number;
    }>;
    sourcePackId: string;
    visualAssetIds: string[];
  };
  sourcePackVerificationStatus: "needs_review" | "ready_for_verifier" | "unverified";
  warnings: Array<{
    code: string;
    message: string;
    severity: "blocker" | "info" | "warning";
  }>;
};

export type StudySourcePackDraftRunPayload = {
  draftPayload: Record<string, unknown>;
  sourceMetadata: Record<string, unknown>;
  sourceText: string;
};

function warningMessages(contract: StudySourcePackGeneratedDeckDraftContract) {
  const deckWarnings = contract.draft.deckWarnings.map((warning) => `deck:${warning.severity}:${warning.message}`);
  const cardWarnings = contract.draft.cards.flatMap((card, index) =>
    card.warnings.map((warning) => `card${index + 1}:${warning.severity}:${warning.message}`),
  );

  return Array.from(new Set(deckWarnings.concat(cardWarnings)));
}

function citationSummary(card: StudySourcePackGeneratedDeckDraftContract["draft"]["cards"][number]) {
  const pages = Array.from(new Set(card.sourceCitation.pageAnchors.map((anchor) => anchor.page))).sort((a, b) => a - b);
  return [
    `sourcePackId=${card.sourceCitation.sourcePackId}`,
    `chunks=${card.sourceCitation.chunkIds.join(",") || "none"}`,
    `pages=${pages.join(",") || "none"}`,
    `visuals=${card.sourceCitation.visualAssetIds.join(",") || "none"}`,
  ].join(" | ");
}

function cardConfidence(card: StudySourcePackGeneratedDeckDraftContract["draft"]["cards"][number]) {
  if (card.warnings.some((warning) => warning.severity === "blocker")) {
    return 0.25;
  }
  if (card.verificationStatus === "ready_for_verifier") {
    return 0.8;
  }
  if (card.verificationStatus === "needs_review") {
    return 0.55;
  }
  return 0.45;
}

function toRunCard(
  card: StudySourcePackGeneratedDeckDraftContract["draft"]["cards"][number],
): StudyDraftCardForRun {
  return {
    answer: card.answer,
    confidence: cardConfidence(card),
    hint: card.hint,
    level: card.level ?? "intermediate",
    question: card.question,
    sourceNotes: citationSummary(card),
    sourcePackCitation: card.sourceCitation,
    sourcePackVerificationStatus: card.verificationStatus,
    warnings: card.warnings,
  };
}

function buildReviewChecklist(contract: StudySourcePackGeneratedDeckDraftContract) {
  const hasDeckBlocker = contract.draft.deckWarnings.some((warning) => warning.severity === "blocker");
  const hasCardBlocker = contract.draft.cards.some((card) => card.warnings.some((warning) => warning.severity === "blocker"));
  const queueReadyCards = contract.draft.cards.filter((card) => card.verificationStatus === "ready_for_verifier").length;

  return {
    hasEnoughCards: contract.draft.cards.length >= 5,
    hasNoBlockerWarnings: !hasDeckBlocker && !hasCardBlocker,
    hasSourceSummary: true,
    needsHumanReview: true,
    readyForVerification: queueReadyCards > 0 && !hasDeckBlocker,
    requiresSourceReview: hasDeckBlocker || hasCardBlocker || queueReadyCards < contract.draft.cards.length,
  };
}

function buildSourceSummary(contract: StudySourcePackGeneratedDeckDraftContract) {
  const pages = Array.from(
    new Set(contract.draft.cards.flatMap((card) => card.sourceCitation.pageAnchors.map((anchor) => anchor.page))),
  ).sort((a, b) => a - b);
  return `Source pack ${contract.draft.sourcePackId} pages ${pages[0] ?? "?"}-${pages.at(-1) ?? "?"}.`;
}

export function buildStudySourcePackDraftRunPayload(args: {
  contract: StudySourcePackGeneratedDeckDraftContract;
  queuePreview: StudySourcePackVerificationQueuePreview;
}): StudySourcePackDraftRunPayload {
  const cards = args.contract.draft.cards.map(toRunCard);
  const generationWarnings = warningMessages(args.contract);
  const sourceSummary = buildSourceSummary(args.contract);

  const draftPayload = {
    cardCount: cards.length,
    cards,
    confidenceSummary: {
      average: Number((cards.reduce((sum, card) => sum + card.confidence, 0) / Math.max(cards.length, 1)).toFixed(2)),
      highConfidenceCount: cards.filter((card) => card.confidence >= 0.7).length,
      lowConfidenceCardIndexes: cards
        .map((card, index) => (card.confidence < 0.7 ? index : -1))
        .filter((index) => index >= 0),
      lowConfidenceCount: cards.filter((card) => card.confidence < 0.7).length,
    },
    description: args.contract.draft.description,
    draftId: args.contract.draft.draftId,
    generatedAt: args.contract.draft.generatedAt,
    generationMode: "ai" as const,
    generationWarnings,
    missingFields: [],
    reviewChecklist: buildReviewChecklist(args.contract),
    sourcePack: {
      sourcePackId: args.contract.draft.sourcePackId,
      verificationStatus: args.contract.draft.verificationStatus,
    },
    sourceSummary,
    subject: args.contract.draft.subject,
    tags: args.contract.draft.tags,
    title: args.contract.draft.title,
  };

  const sourceMetadata = {
    mode: "source_pack_draft_run_save",
    queuePreviewSummary: {
      blockedCount: args.queuePreview.queueItems.filter((item) => item.recommendedVerifierStatus === "blocked").length,
      queuedCount: args.queuePreview.queueItems.filter((item) => item.recommendedVerifierStatus === "queued_for_verifier").length,
      verificationStatusCounts: args.queuePreview.summary.verificationStatusCounts,
      warningCounts: args.queuePreview.summary.warningCounts,
    },
    sourcePack: {
      draftId: args.contract.draft.draftId,
      sourcePackId: args.contract.draft.sourcePackId,
      title: args.contract.draft.title,
      uniqueChunkIds: args.queuePreview.summary.uniqueChunkIds,
      uniqueVisualAssetIds: args.queuePreview.summary.uniqueVisualAssetIds,
    },
  };

  const sourceText = [
    `Source-pack Study deck draft: ${args.contract.draft.title}`,
    `Description: ${args.contract.draft.description}`,
    `Source pack: ${args.contract.draft.sourcePackId}`,
    `Cards: ${cards.length}`,
    `Tags: ${args.contract.draft.tags.join(", ") || "none"}`,
    `Warnings: ${generationWarnings.join(" | ") || "none"}`,
  ].join("\n");

  return {
    draftPayload,
    sourceMetadata,
    sourceText,
  };
}
