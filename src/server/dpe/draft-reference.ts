export type DpeDraftReferenceVerificationStatus =
  | "generated"
  | "needs_admin_review"
  | "admin_reviewed"
  | "rejected";

export type DpeDraftReferenceItem = {
  acsTags: string[];
  pageAnchors: string[];
  promptReference: string;
  referenceId: string;
  sourceChunkIds: string[];
  sourcePackId: string;
  subjectTags: string[];
  trackApplicability: string[];
  verificationStatus: DpeDraftReferenceVerificationStatus;
  visualAssetIds: string[];
  warnings: string[];
};

export type DpeDraftReferenceContract = {
  durableSourcePackStorage: false;
  items: DpeDraftReferenceItem[];
  mode: "draft_admin_reference_only";
  officialEnabled: false;
  publishEnabled: false;
  sourcePackIds: string[];
  verifiedEnabled: false;
  warnings: string[];
};

const allowedVerificationStatuses = new Set<DpeDraftReferenceVerificationStatus>([
  "generated",
  "needs_admin_review",
  "admin_reviewed",
  "rejected",
]);

const MAX_REFERENCE_ITEMS = 20;
const MAX_REFERENCE_TEXT_CHARS = 2_000;
const MAX_STRING_CHARS = 240;

function clean(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanList(value: unknown, maxItems = 30) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, MAX_STRING_CHARS))
        .filter(Boolean),
    ),
  ).slice(0, maxItems);
}

function cleanVerificationStatus(value: unknown): DpeDraftReferenceVerificationStatus {
  const status = clean(value) as DpeDraftReferenceVerificationStatus;
  return allowedVerificationStatuses.has(status) ? status : "generated";
}

function normalizeReferenceItem(value: unknown, index: number): DpeDraftReferenceItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const sourcePackId = clean(candidate.sourcePackId).slice(0, MAX_STRING_CHARS);
  const referenceId =
    clean(candidate.referenceId) ||
    clean(candidate.id) ||
    [sourcePackId, index + 1].filter(Boolean).join(":");
  const sourceChunkIds = cleanList(candidate.sourceChunkIds ?? candidate.chunkIds);
  const visualAssetIds = cleanList(candidate.visualAssetIds ?? candidate.assetIds);
  const promptReference = clean(
    candidate.promptReference ?? candidate.referenceText ?? candidate.excerpt,
  ).slice(0, MAX_REFERENCE_TEXT_CHARS);

  if (!sourcePackId || !referenceId || !promptReference) {
    return null;
  }

  return {
    acsTags: cleanList(candidate.acsTags ?? candidate.acsReferences),
    pageAnchors: cleanList(candidate.pageAnchors ?? candidate.anchors),
    promptReference,
    referenceId: referenceId.slice(0, MAX_STRING_CHARS),
    sourceChunkIds,
    sourcePackId,
    subjectTags: cleanList(candidate.subjectTags ?? candidate.subjects ?? candidate.tags),
    trackApplicability: cleanList(candidate.trackApplicability ?? candidate.trackCodes),
    verificationStatus: cleanVerificationStatus(candidate.verificationStatus),
    visualAssetIds,
    warnings: cleanList(candidate.warnings, 12),
  };
}

export function buildDpeDraftReferenceContract(
  items: DpeDraftReferenceItem[] = [],
): DpeDraftReferenceContract {
  const normalizedItems = items.slice(0, MAX_REFERENCE_ITEMS);
  const sourcePackIds = Array.from(new Set(normalizedItems.map((item) => item.sourcePackId))).sort();
  const warnings = [
    "Draft references are admin/reviewer inputs only and are not read by learner runtime.",
    "Publishing, Official, Verified, and durable source-pack storage writes are disabled.",
    ...normalizedItems.flatMap((item) => item.warnings),
  ];

  return {
    durableSourcePackStorage: false,
    items: normalizedItems,
    mode: "draft_admin_reference_only",
    officialEnabled: false,
    publishEnabled: false,
    sourcePackIds,
    verifiedEnabled: false,
    warnings: Array.from(new Set(warnings)),
  };
}

export function parseDpeDraftReferenceItems(value: unknown): {
  error: string;
  items: DpeDraftReferenceItem[];
} | {
  items: DpeDraftReferenceItem[];
  ok: true;
} {
  if (value === undefined || value === null) {
    return { items: [], ok: true };
  }

  if (!Array.isArray(value)) {
    return {
      error: "DPE draft reference items must be an array when provided.",
      items: [],
    };
  }

  const items = value
    .slice(0, MAX_REFERENCE_ITEMS)
    .map((item, index) => normalizeReferenceItem(item, index))
    .filter((item): item is DpeDraftReferenceItem => Boolean(item));

  if (value.length > 0 && items.length === 0) {
    return {
      error:
        "DPE draft reference items require sourcePackId, referenceId or id, and promptReference/referenceText/excerpt.",
      items: [],
    };
  }

  return { items, ok: true };
}
