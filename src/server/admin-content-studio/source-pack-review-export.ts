type ReviewCountKey = "accepted" | "candidate" | "needs_edit" | "rejected";

type SourcePackReviewExportManifest = {
  id: string;
  sourceIds: string[];
  title: string;
};

type SourcePackReviewExport = {
  acceptedChunkIds: string[];
  acceptedVisualIds: string[];
  manifest: SourcePackReviewExportManifest;
  notes: Array<{
    candidateId: string;
    candidateType: string;
    note: string;
  }>;
  reviewCounts: Record<ReviewCountKey, number>;
  reviewedVisualIds: string[];
  reviewRunId: string;
  restrictions: string[];
  sourceAnchors: Array<{
    candidateId: string;
    candidateType: string;
    sourceAnchor: string;
    sourceId: string;
  }>;
  stage: "source_pack_admin_review_export_preview";
};

type ParseResult =
  | { exportPayload: SourcePackReviewExport; ok: true }
  | { errors: string[]; ok: false };

const REQUIRED_RESTRICTIONS = [
  "admin_review_export_preview_only",
  "durable_admin_artifact_only",
  "no_drive_loading",
  "no_product_import",
  "no_publish_official_or_verified_write",
  "study_generation_first_dpe_later",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => stringValue(item)).filter(Boolean)
    : [];
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

function parseReviewCounts(value: unknown, errors: string[]) {
  const counts = isRecord(value) ? value : {};
  const parsed = {
    accepted: numberValue(counts.accepted),
    candidate: numberValue(counts.candidate),
    needs_edit: numberValue(counts.needs_edit),
    rejected: numberValue(counts.rejected),
  };

  for (const [key, count] of Object.entries(parsed)) {
    if (!Number.isInteger(count) || count < 0) {
      errors.push(`reviewCounts.${key} must be a non-negative integer.`);
    }
  }

  return parsed;
}

function parseSourceAnchors(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("sourceAnchors must be an array.");
    return [];
  }

  return value
    .map((item, index) => {
      if (!isRecord(item)) {
        errors.push(`sourceAnchors[${index}] must be an object.`);
        return undefined;
      }

      const candidateId = stringValue(item.candidateId);
      const candidateType = stringValue(item.candidateType);
      const sourceAnchor = stringValue(item.sourceAnchor);
      const sourceId = stringValue(item.sourceId);

      if (!candidateId) errors.push(`sourceAnchors[${index}].candidateId is required.`);
      if (!candidateType) errors.push(`sourceAnchors[${index}].candidateType is required.`);
      if (!sourceAnchor) errors.push(`sourceAnchors[${index}].sourceAnchor is required.`);
      if (!sourceId) errors.push(`sourceAnchors[${index}].sourceId is required.`);

      if (!candidateId || !candidateType || !sourceAnchor || !sourceId) {
        return undefined;
      }

      return {
        candidateId,
        candidateType,
        sourceAnchor,
        sourceId,
      };
    })
    .filter((item): item is SourcePackReviewExport["sourceAnchors"][number] =>
      Boolean(item),
    );
}

function parseNotes(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("notes must be an array.");
    return [];
  }

  return value
    .map((item, index) => {
      if (!isRecord(item)) {
        errors.push(`notes[${index}] must be an object.`);
        return undefined;
      }

      const candidateId = stringValue(item.candidateId);
      const candidateType = stringValue(item.candidateType);
      const note = stringValue(item.note);

      if (!candidateId) errors.push(`notes[${index}].candidateId is required.`);
      if (!candidateType) errors.push(`notes[${index}].candidateType is required.`);
      if (!note) errors.push(`notes[${index}].note is required.`);

      if (!candidateId || !candidateType || !note) {
        return undefined;
      }

      return {
        candidateId,
        candidateType,
        note: note.slice(0, 5_000),
      };
    })
    .filter((item): item is SourcePackReviewExport["notes"][number] =>
      Boolean(item),
    );
}

export function parseSourcePackReviewExportPayload(payload: unknown): ParseResult {
  const errors: string[] = [];

  if (!isRecord(payload)) {
    return { errors: ["Payload must be a JSON object."], ok: false };
  }

  const manifest = isRecord(payload.manifest) ? payload.manifest : {};
  const manifestId = stringValue(manifest.id);
  const manifestTitle = stringValue(manifest.title);
  const sourceIds = stringArray(manifest.sourceIds);
  const reviewRunId = stringValue(payload.reviewRunId);
  const restrictions = stringArray(payload.restrictions);
  const acceptedChunkIds = stringArray(payload.acceptedChunkIds);
  const acceptedVisualIds = stringArray(payload.acceptedVisualIds);
  const reviewedVisualIds = stringArray(payload.reviewedVisualIds);
  const notes = parseNotes(payload.notes, errors);
  const reviewCounts = parseReviewCounts(payload.reviewCounts, errors);
  const sourceAnchors = parseSourceAnchors(payload.sourceAnchors, errors);

  if (payload.stage !== "source_pack_admin_review_export_preview") {
    errors.push("stage must be source_pack_admin_review_export_preview.");
  }
  if (!manifestId) errors.push("manifest.id is required.");
  if (!manifestTitle) errors.push("manifest.title is required.");
  if (sourceIds.length === 0) errors.push("manifest.sourceIds must include at least one source id.");
  if (!reviewRunId) errors.push("reviewRunId is required.");
  if (!Array.isArray(payload.acceptedChunkIds)) errors.push("acceptedChunkIds must be an array.");
  if (!Array.isArray(payload.acceptedVisualIds)) errors.push("acceptedVisualIds must be an array.");
  if (!Array.isArray(payload.reviewedVisualIds)) errors.push("reviewedVisualIds must be an array.");

  for (const restriction of REQUIRED_RESTRICTIONS) {
    if (!restrictions.includes(restriction)) {
      errors.push(`restrictions must include ${restriction}.`);
    }
  }
  if (restrictions.includes("no_database_write")) {
    errors.push("restrictions.no_database_write is not valid for durable review artifact save.");
  }

  if (errors.length > 0) {
    return { errors, ok: false };
  }

  return {
    exportPayload: {
      acceptedChunkIds,
      acceptedVisualIds,
      manifest: {
        id: manifestId,
        sourceIds,
        title: manifestTitle,
      },
      notes,
      reviewCounts,
      reviewedVisualIds,
      reviewRunId,
      restrictions,
      sourceAnchors,
      stage: "source_pack_admin_review_export_preview",
    },
    ok: true,
  };
}

export function buildSourcePackReviewExportDraft(exportPayload: SourcePackReviewExport) {
  return {
    cardCount: 0,
    cards: [],
    description:
      "Durable Admin review artifact for source-pack decisions. This is not a Study deck import.",
    generationMode: "source_pack_review_export",
    generationWarnings: [
      "Saved review artifact only. Study/DPE imports, Publish, Official, and Verified remain disabled.",
    ],
    missingFields: [],
    reviewChecklist: {
      acceptedChunksSelected: exportPayload.acceptedChunkIds.length > 0,
      durableArtifactSaved: true,
      productImportDisabled: true,
      sourceAnchorsPresent: exportPayload.sourceAnchors.length > 0,
    },
    sourcePackReviewExport: exportPayload,
    sourceSummary: `Source-pack review export for ${exportPayload.manifest.title}. Accepted chunks: ${exportPayload.acceptedChunkIds.length}. Accepted visuals: ${exportPayload.acceptedVisualIds.length}.`,
    tags: ["source-pack-review", "admin-review-artifact"],
    title: `Source-pack review export: ${exportPayload.manifest.title}`,
  };
}
