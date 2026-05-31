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

export type DpeReferencePacketSourcePack = {
  id: string;
  pageRange: {
    end: number;
    start: number;
  };
  title: string;
};

export type DpeReferencePacketReviewSummary = {
  itemCount: number;
  itemsByVerificationStatus: Record<DpeDraftReferenceVerificationStatus, number>;
  pageAnchorCount: number;
  sourceChunkCount: number;
  sourcePack: DpeReferencePacketSourcePack;
  trackApplicability: string[];
  visualAssetCount: number;
  warningCount: number;
};

export type DpeReferencePacketPreview = {
  draftReferenceContract: DpeDraftReferenceContract;
  reviewSummary: DpeReferencePacketReviewSummary;
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
const REFERENCE_PACKET_VERSION = "quesiq.dpeReferencePacket.v1";
const REFERENCE_PACKET_TARGET_CONTRACT = "dpe.draftReference.v1";
const REFERENCE_PACKET_MODE = "draft_admin_reference_only";

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

function isDisabledRestriction(value: unknown): boolean {
  if (value === false) return true;
  if (typeof value === "string") return value.trim().toLowerCase() === "disabled";
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.values(value).every(isDisabledRestriction);
  }

  return false;
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

function parseSourcePack(value: unknown): { error: string } | { sourcePack: DpeReferencePacketSourcePack } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "DPE reference packet sourcePack must be an object." };
  }

  const candidate = value as Record<string, unknown>;
  const id = clean(candidate.id).slice(0, MAX_STRING_CHARS);
  const title = clean(candidate.title).slice(0, MAX_STRING_CHARS);
  const pageRange = candidate.pageRange;

  if (!id) return { error: "DPE reference packet sourcePack.id is required." };
  if (!title) return { error: "DPE reference packet sourcePack.title is required." };
  const range = pageRange && typeof pageRange === "object" && !Array.isArray(pageRange)
    ? (pageRange as Record<string, unknown>)
    : candidate;
  const start = Number(range.start ?? range.pageStart);
  const end = Number(range.end ?? range.pageEnd);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    return { error: "DPE reference packet sourcePack.pageRange must include integer start/end pages." };
  }

  return {
    sourcePack: {
      id,
      pageRange: { end, start },
      title,
    },
  };
}

function parseRestrictions(value: unknown): { error: string } | { ok: true } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "DPE reference packet restrictions must be an object." };
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return { error: "DPE reference packet restrictions must be explicit." };
  }

  const enabled = entries.filter(([, restriction]) => !isDisabledRestriction(restriction));
  if (enabled.length > 0) {
    return {
      error:
        "DPE reference packet restrictions must all be false or disabled; publish, Official, Verified, durable storage, and learner runtime are not allowed.",
    };
  }

  return { ok: true };
}

function buildReviewSummary(
  sourcePack: DpeReferencePacketSourcePack,
  contract: DpeDraftReferenceContract,
): DpeReferencePacketReviewSummary {
  const statusCounts: Record<DpeDraftReferenceVerificationStatus, number> = {
    admin_reviewed: 0,
    generated: 0,
    needs_admin_review: 0,
    rejected: 0,
  };

  for (const item of contract.items) {
    statusCounts[item.verificationStatus] += 1;
  }

  return {
    itemCount: contract.items.length,
    itemsByVerificationStatus: statusCounts,
    pageAnchorCount: new Set(contract.items.flatMap((item) => item.pageAnchors)).size,
    sourceChunkCount: new Set(contract.items.flatMap((item) => item.sourceChunkIds)).size,
    sourcePack,
    trackApplicability: Array.from(
      new Set(contract.items.flatMap((item) => item.trackApplicability)),
    ).sort(),
    visualAssetCount: new Set(contract.items.flatMap((item) => item.visualAssetIds)).size,
    warningCount: contract.items.reduce((total, item) => total + item.warnings.length, 0),
  };
}

export function parseDpeReferencePacketPreview(value: unknown): {
  error: string;
  ok: false;
  status?: number;
} | {
  ok: true;
  preview: DpeReferencePacketPreview;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "DPE reference packet preview payload must be an object.", ok: false, status: 400 };
  }

  const packet = value as Record<string, unknown>;
  if (packet.packetVersion !== REFERENCE_PACKET_VERSION) {
    return { error: `packetVersion must be ${REFERENCE_PACKET_VERSION}.`, ok: false, status: 400 };
  }
  if (packet.targetContract !== REFERENCE_PACKET_TARGET_CONTRACT) {
    return { error: `targetContract must be ${REFERENCE_PACKET_TARGET_CONTRACT}.`, ok: false, status: 400 };
  }
  if (packet.mode !== REFERENCE_PACKET_MODE) {
    return { error: `mode must be ${REFERENCE_PACKET_MODE}.`, ok: false, status: 400 };
  }

  const parsedRestrictions = parseRestrictions(packet.restrictions);
  if ("error" in parsedRestrictions) return { error: parsedRestrictions.error, ok: false, status: 400 };

  const parsedSourcePack = parseSourcePack(packet.sourcePack);
  if ("error" in parsedSourcePack) return { error: parsedSourcePack.error, ok: false, status: 400 };

  const rawItems = Array.isArray(packet.items)
    ? packet.items.map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? { sourcePackId: parsedSourcePack.sourcePack.id, ...item }
          : item,
      )
    : packet.items;
  const parsedItems = parseDpeDraftReferenceItems(rawItems);
  if ("error" in parsedItems) return { error: parsedItems.error, ok: false, status: 400 };
  if (parsedItems.items.length === 0) {
    return { error: "DPE reference packet requires at least one valid item.", ok: false, status: 400 };
  }

  const mismatchedSourcePack = parsedItems.items.find(
    (item) => item.sourcePackId !== parsedSourcePack.sourcePack.id,
  );
  if (mismatchedSourcePack) {
    return {
      error: "DPE reference packet item sourcePackId values must match sourcePack.id.",
      ok: false,
      status: 400,
    };
  }

  const contract = buildDpeDraftReferenceContract(parsedItems.items);
  return {
    ok: true,
    preview: {
      draftReferenceContract: contract,
      reviewSummary: buildReviewSummary(parsedSourcePack.sourcePack, contract),
    },
  };
}
