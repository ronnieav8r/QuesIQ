import type {
  StudySourcePackCitation,
  StudySourcePackGeneratedDeckDraftContract,
  StudySourcePackVerificationStatus,
  StudySourcePackWarningSeverity,
} from "@/server/study/study-source-pack-draft-contract";

export type StudySourcePackVerificationQueueItem = {
  answer: string;
  cardIndex: number;
  existingWarnings: {
    code: string;
    message: string;
    severity: StudySourcePackWarningSeverity;
  }[];
  question: string;
  recommendedVerifierAction: "hold_for_human_review" | "queued_for_verifier";
  recommendedVerifierStatus: "blocked" | "queued_for_verifier";
  sourceCitation: StudySourcePackCitation;
  tags: string[];
  verificationStatus: StudySourcePackVerificationStatus;
};

export type StudySourcePackVerificationQueuePreview = {
  draftId: string;
  previewOnly: true;
  restrictions: {
    callsAiVerifier: false;
    canMarkOfficial: false;
    canMarkVerified: false;
    canPublish: false;
    writesStudyDecks: false;
  };
  sourcePackId: string;
  summary: {
    cardCount: number;
    uniqueChunkIds: number;
    uniqueVisualAssetIds: number;
    warningCounts: {
      blocker: number;
      info: number;
      warning: number;
    };
    verificationStatusCounts: Record<StudySourcePackVerificationStatus, number>;
    pageAnchorsCount: number;
    title: string;
  };
  queueItems: StudySourcePackVerificationQueueItem[];
};

function accumulateWarningCounts(
  warnings: Array<{ severity: StudySourcePackWarningSeverity }>,
  counts: { blocker: number; info: number; warning: number },
) {
  for (const warning of warnings) {
    if (warning.severity === "blocker") counts.blocker += 1;
    if (warning.severity === "warning") counts.warning += 1;
    if (warning.severity === "info") counts.info += 1;
  }
}

export function buildStudySourcePackVerificationQueuePreview(
  contract: StudySourcePackGeneratedDeckDraftContract,
): StudySourcePackVerificationQueuePreview {
  const uniqueChunkIds = new Set<string>();
  const uniqueVisualAssetIds = new Set<string>();
  let pageAnchorsCount = 0;

  const warningCounts = { blocker: 0, info: 0, warning: 0 };
  accumulateWarningCounts(contract.draft.deckWarnings, warningCounts);

  const verificationStatusCounts: Record<StudySourcePackVerificationStatus, number> = {
    needs_review: 0,
    ready_for_verifier: 0,
    unverified: 0,
  };

  const deckHasBlockerWarning = contract.draft.deckWarnings.some((warning) => warning.severity === "blocker");

  const queueItems = contract.draft.cards.map((card, index): StudySourcePackVerificationQueueItem => {
    for (const chunkId of card.sourceCitation.chunkIds) uniqueChunkIds.add(chunkId);
    for (const visualId of card.sourceCitation.visualAssetIds) uniqueVisualAssetIds.add(visualId);
    pageAnchorsCount += card.sourceCitation.pageAnchors.length;

    accumulateWarningCounts(card.warnings, warningCounts);
    verificationStatusCounts[card.verificationStatus] += 1;

    const cardHasBlockerWarning = card.warnings.some((warning) => warning.severity === "blocker");
    const blocked = deckHasBlockerWarning || cardHasBlockerWarning;

    return {
      answer: card.answer,
      cardIndex: index + 1,
      existingWarnings: card.warnings,
      question: card.question,
      recommendedVerifierAction: blocked ? "hold_for_human_review" : "queued_for_verifier",
      recommendedVerifierStatus: blocked ? "blocked" : "queued_for_verifier",
      sourceCitation: card.sourceCitation,
      tags: card.tags,
      verificationStatus: card.verificationStatus,
    };
  });

  return {
    draftId: contract.draft.draftId,
    previewOnly: true,
    queueItems,
    restrictions: {
      callsAiVerifier: false,
      canMarkOfficial: false,
      canMarkVerified: false,
      canPublish: false,
      writesStudyDecks: false,
    },
    sourcePackId: contract.draft.sourcePackId,
    summary: {
      cardCount: contract.draft.cards.length,
      pageAnchorsCount,
      title: contract.draft.title,
      uniqueChunkIds: uniqueChunkIds.size,
      uniqueVisualAssetIds: uniqueVisualAssetIds.size,
      verificationStatusCounts,
      warningCounts,
    },
  };
}

export function getStudySourcePackVerificationQueueReviewSections(preview: StudySourcePackVerificationQueuePreview) {
  const queuedCount = preview.queueItems.filter((item) => item.recommendedVerifierStatus === "queued_for_verifier").length;
  const blockedCount = preview.queueItems.length - queuedCount;
  return [
    {
      items: [
        `Draft ID: ${preview.draftId}`,
        `Source Pack: ${preview.sourcePackId}`,
        `Deck title: ${preview.summary.title}`,
        `Cards: ${preview.summary.cardCount}`,
      ],
      title: "Verification Queue Metadata",
    },
    {
      items: [
        `Queued for verifier: ${queuedCount}`,
        `Blocked by warnings: ${blockedCount}`,
        `Unique chunk ids: ${preview.summary.uniqueChunkIds}`,
        `Page anchors: ${preview.summary.pageAnchorsCount}`,
        `Unique visual assets: ${preview.summary.uniqueVisualAssetIds}`,
      ],
      title: "Queue Coverage",
    },
    {
      items: [
        `Draft warnings - blocker/warning/info: ${preview.summary.warningCounts.blocker}/${preview.summary.warningCounts.warning}/${preview.summary.warningCounts.info}`,
        `Card status counts - unverified/needs_review/ready_for_verifier: ${preview.summary.verificationStatusCounts.unverified}/${preview.summary.verificationStatusCounts.needs_review}/${preview.summary.verificationStatusCounts.ready_for_verifier}`,
        "AI verifier call: disabled",
        "Study write/import/publish/Official/Verified: disabled",
      ],
      title: "Restrictions",
    },
  ];
}
