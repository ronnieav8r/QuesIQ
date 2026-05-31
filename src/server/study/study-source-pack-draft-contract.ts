export type StudySourcePackWarningSeverity = "blocker" | "info" | "warning";
export type StudySourcePackVerificationStatus = "needs_review" | "ready_for_verifier" | "unverified";

export type StudySourcePackPageAnchor = {
  page: number;
  x1?: number;
  x2?: number;
  y1?: number;
  y2?: number;
};

export type StudySourcePackCitation = {
  chunkIds: string[];
  pageAnchors: StudySourcePackPageAnchor[];
  sourcePackId: string;
  visualAssetIds: string[];
};

export type StudySourcePackDraftWarning = {
  code: string;
  message: string;
  severity: StudySourcePackWarningSeverity;
};

export type StudySourcePackGeneratedCardDraft = {
  answer: string;
  hint?: string;
  level?: "advanced" | "beginner" | "intermediate";
  question: string;
  sourceCitation: StudySourcePackCitation;
  tags: string[];
  verificationStatus: StudySourcePackVerificationStatus;
  warnings: StudySourcePackDraftWarning[];
};

export type StudySourcePackGeneratedDeckDraft = {
  cards: StudySourcePackGeneratedCardDraft[];
  deckWarnings: StudySourcePackDraftWarning[];
  description: string;
  draftId: string;
  generatedAt: string;
  sourcePackId: string;
  subject?: string;
  tags: string[];
  title: string;
  verificationStatus: StudySourcePackVerificationStatus;
};

export type StudySourcePackGeneratedDeckDraftContract = {
  contractVersion: "study.sourcePackDeckDraft.v1";
  draft: StudySourcePackGeneratedDeckDraft;
  mode: "draft_preview_only";
  restrictions: {
    canMarkOfficial: false;
    canMarkVerified: false;
    canPublish: false;
    writesStudyDecks: false;
  };
};

type ParseResult =
  | { draft: StudySourcePackGeneratedDeckDraftContract; ok: true }
  | { errors: string[]; ok: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseSeverity(value: unknown): StudySourcePackWarningSeverity | null {
  return value === "blocker" || value === "info" || value === "warning" ? value : null;
}

function parseVerificationStatus(value: unknown): StudySourcePackVerificationStatus | null {
  return value === "needs_review" || value === "ready_for_verifier" || value === "unverified" ? value : null;
}

function parseWarning(value: unknown, path: string, errors: string[]): StudySourcePackDraftWarning | null {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return null;
  }
  const code = asTrimmedString(value.code);
  const message = asTrimmedString(value.message);
  const severity = parseSeverity(value.severity);
  if (!code) errors.push(`${path}.code is required.`);
  if (!message) errors.push(`${path}.message is required.`);
  if (!severity) errors.push(`${path}.severity must be blocker|warning|info.`);
  if (!code || !message || !severity) return null;
  return { code, message, severity };
}

function parsePageAnchor(value: unknown, path: string, errors: string[]): StudySourcePackPageAnchor | null {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return null;
  }
  const page = typeof value.page === "number" ? value.page : Number.NaN;
  if (!Number.isInteger(page) || page < 1) {
    errors.push(`${path}.page must be an integer >= 1.`);
    return null;
  }
  const coords = ["x1", "x2", "y1", "y2"] as const;
  const parsed: StudySourcePackPageAnchor = { page };
  for (const coord of coords) {
    const coordValue = value[coord];
    if (coordValue === undefined) continue;
    if (typeof coordValue !== "number" || Number.isNaN(coordValue)) {
      errors.push(`${path}.${coord} must be a number when provided.`);
      continue;
    }
    parsed[coord] = coordValue;
  }
  return parsed;
}

function stringArray(value: unknown, path: string, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array of strings.`);
    return [];
  }
  const values = value
    .map((item) => asTrimmedString(item))
    .filter(Boolean);
  if (values.length !== value.length) {
    errors.push(`${path} must contain only non-empty strings.`);
  }
  return Array.from(new Set(values));
}

function parseCitation(value: unknown, path: string, errors: string[]): StudySourcePackCitation | null {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return null;
  }
  const sourcePackId = asTrimmedString(value.sourcePackId);
  const chunkIds = stringArray(value.chunkIds, `${path}.chunkIds`, errors);
  const visualAssetIds = stringArray(value.visualAssetIds, `${path}.visualAssetIds`, errors);

  const rawAnchors = Array.isArray(value.pageAnchors) ? value.pageAnchors : [];
  if (!Array.isArray(value.pageAnchors)) {
    errors.push(`${path}.pageAnchors must be an array.`);
  }
  const pageAnchors = rawAnchors
    .map((anchor, index) => parsePageAnchor(anchor, `${path}.pageAnchors[${index}]`, errors))
    .filter((anchor): anchor is StudySourcePackPageAnchor => Boolean(anchor));

  if (!sourcePackId) errors.push(`${path}.sourcePackId is required.`);
  if (chunkIds.length === 0) errors.push(`${path}.chunkIds must include at least one chunk id.`);
  if (pageAnchors.length === 0) errors.push(`${path}.pageAnchors must include at least one anchor.`);
  if (!sourcePackId || chunkIds.length === 0 || pageAnchors.length === 0) return null;

  return {
    chunkIds,
    pageAnchors,
    sourcePackId,
    visualAssetIds,
  };
}

function parseCard(value: unknown, path: string, errors: string[]): StudySourcePackGeneratedCardDraft | null {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return null;
  }
  const question = asTrimmedString(value.question);
  const answer = asTrimmedString(value.answer);
  const hint = asTrimmedString(value.hint) || undefined;
  const level = value.level;
  const parsedLevel =
    level === "advanced" || level === "beginner" || level === "intermediate" || level === undefined ? level : null;
  const verificationStatus = parseVerificationStatus(value.verificationStatus);
  const sourceCitation = parseCitation(value.sourceCitation, `${path}.sourceCitation`, errors);
  const tags = stringArray(value.tags, `${path}.tags`, errors);
  const rawWarnings = Array.isArray(value.warnings) ? value.warnings : [];
  if (!Array.isArray(value.warnings)) {
    errors.push(`${path}.warnings must be an array.`);
  }
  const warnings = rawWarnings
    .map((warning, index) => parseWarning(warning, `${path}.warnings[${index}]`, errors))
    .filter((warning): warning is StudySourcePackDraftWarning => Boolean(warning));

  if (!question) errors.push(`${path}.question is required.`);
  if (!answer) errors.push(`${path}.answer is required.`);
  if (parsedLevel === null) errors.push(`${path}.level must be beginner|intermediate|advanced when provided.`);
  if (!verificationStatus) errors.push(`${path}.verificationStatus must be unverified|needs_review|ready_for_verifier.`);
  if (!sourceCitation) errors.push(`${path}.sourceCitation is invalid.`);
  if (!question || !answer || parsedLevel === null || !verificationStatus || !sourceCitation) return null;

  return {
    answer,
    hint,
    level: parsedLevel,
    question,
    sourceCitation,
    tags,
    verificationStatus,
    warnings,
  };
}

export function parseStudySourcePackGeneratedDeckDraftContract(value: unknown): ParseResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { errors: ["Contract payload must be an object."], ok: false };
  }
  if (value.contractVersion !== "study.sourcePackDeckDraft.v1") {
    errors.push("contractVersion must be study.sourcePackDeckDraft.v1.");
  }
  if (value.mode !== "draft_preview_only") {
    errors.push("mode must be draft_preview_only.");
  }
  if (!isRecord(value.restrictions)) {
    errors.push("restrictions must be an object.");
  } else {
    const restrictions = value.restrictions;
    if (restrictions.canPublish !== false) errors.push("restrictions.canPublish must be false.");
    if (restrictions.canMarkOfficial !== false) errors.push("restrictions.canMarkOfficial must be false.");
    if (restrictions.canMarkVerified !== false) errors.push("restrictions.canMarkVerified must be false.");
    if (restrictions.writesStudyDecks !== false) errors.push("restrictions.writesStudyDecks must be false.");
  }
  if (!isRecord(value.draft)) {
    errors.push("draft must be an object.");
    return { errors, ok: false };
  }

  const draftValue = value.draft;
  const draftId = asTrimmedString(draftValue.draftId);
  const sourcePackId = asTrimmedString(draftValue.sourcePackId);
  const title = asTrimmedString(draftValue.title);
  const description = asTrimmedString(draftValue.description);
  const subject = asTrimmedString(draftValue.subject) || undefined;
  const generatedAt = asTrimmedString(draftValue.generatedAt);
  const verificationStatus = parseVerificationStatus(draftValue.verificationStatus);
  const tags = stringArray(draftValue.tags, "draft.tags", errors);

  const rawCards = Array.isArray(draftValue.cards) ? draftValue.cards : [];
  if (!Array.isArray(draftValue.cards)) errors.push("draft.cards must be an array.");
  const cards = rawCards
    .map((card, index) => parseCard(card, `draft.cards[${index}]`, errors))
    .filter((card): card is StudySourcePackGeneratedCardDraft => Boolean(card));

  const rawDeckWarnings = Array.isArray(draftValue.deckWarnings) ? draftValue.deckWarnings : [];
  if (!Array.isArray(draftValue.deckWarnings)) errors.push("draft.deckWarnings must be an array.");
  const deckWarnings = rawDeckWarnings
    .map((warning, index) => parseWarning(warning, `draft.deckWarnings[${index}]`, errors))
    .filter((warning): warning is StudySourcePackDraftWarning => Boolean(warning));

  if (!draftId) errors.push("draft.draftId is required.");
  if (!sourcePackId) errors.push("draft.sourcePackId is required.");
  if (!title) errors.push("draft.title is required.");
  if (!description) errors.push("draft.description is required.");
  if (!generatedAt) errors.push("draft.generatedAt is required.");
  if (!verificationStatus) errors.push("draft.verificationStatus must be unverified|needs_review|ready_for_verifier.");
  if (cards.length === 0) errors.push("draft.cards must include at least one valid card.");
  if (cards.some((card) => card.sourceCitation.sourcePackId !== sourcePackId)) {
    errors.push("Each card sourceCitation.sourcePackId must match draft.sourcePackId.");
  }

  if (
    errors.length > 0 ||
    !draftId ||
    !sourcePackId ||
    !title ||
    !description ||
    !generatedAt ||
    !verificationStatus ||
    cards.length === 0
  ) {
    return { errors, ok: false };
  }

  return {
    draft: {
      contractVersion: "study.sourcePackDeckDraft.v1",
      draft: {
        cards,
        deckWarnings,
        description,
        draftId,
        generatedAt,
        sourcePackId,
        subject,
        tags,
        title,
        verificationStatus,
      },
      mode: "draft_preview_only",
      restrictions: {
        canMarkOfficial: false,
        canMarkVerified: false,
        canPublish: false,
        writesStudyDecks: false,
      },
    },
    ok: true,
  };
}

export function getStudySourcePackDraftReviewSections(contract: StudySourcePackGeneratedDeckDraftContract) {
  const cardWarnings = contract.draft.cards.flatMap((card) => card.warnings);
  return [
    {
      items: [
        `Source Pack: ${contract.draft.sourcePackId}`,
        `Draft ID: ${contract.draft.draftId}`,
        `Cards: ${contract.draft.cards.length}`,
        `Verification status: ${contract.draft.verificationStatus}`,
      ],
      title: "Source-Pack Draft Metadata",
    },
    {
      items: [
        `Deck warnings: ${contract.draft.deckWarnings.length}`,
        `Card warnings: ${cardWarnings.length}`,
        `Unique tags: ${Array.from(new Set(contract.draft.tags)).length}`,
      ],
      title: "Warnings And Tags",
    },
    {
      items: [
        "Publish: disabled",
        "Official status: disabled",
        "Verified status: disabled",
        "Study runtime write: disabled",
      ],
      title: "Restrictions",
    },
  ];
}

export const STUDY_SOURCE_PACK_DRAFT_SAMPLE: StudySourcePackGeneratedDeckDraftContract = {
  contractVersion: "study.sourcePackDeckDraft.v1",
  draft: {
    cards: [
      {
        answer: "Use small, deliberate control pressures while scanning outside for references.",
        hint: "Start with pitch trim before large control input.",
        level: "beginner",
        question: "What is a stable way to keep control during visual maneuver practice?",
        sourceCitation: {
          chunkIds: ["chunk-001", "chunk-002"],
          pageAnchors: [{ page: 12, x1: 0.12, x2: 0.75, y1: 0.18, y2: 0.42 }],
          sourcePackId: "sample-source-pack",
          visualAssetIds: ["figure-12-a"],
        },
        tags: ["fundamentals", "visual-maneuvers"],
        verificationStatus: "unverified",
        warnings: [{ code: "needs_verifier_pass", message: "Requires verifier pass before Study import.", severity: "warning" }],
      },
    ],
    deckWarnings: [{ code: "sample_only", message: "Sample contract fixture for preview and validation only.", severity: "info" }],
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
};
