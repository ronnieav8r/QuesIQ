import { eq, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { studyCards, studyCardSources, studyDeckImports, studyDecks, studyVerifications } from "@/server/db/schema";

export const STUDY_RICH_IMPORT_HEADERS = [
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
  "isOfficial",
  "isVerified",
] as const;
export type StudyRichImportTargetField = (typeof STUDY_RICH_IMPORT_HEADERS)[number];
export type StudyRichImportColumnMapping = Partial<Record<StudyRichImportTargetField, string>>;

export const STUDY_RICH_IMPORT_DEFAULT_COLUMN_MAPPING: Record<StudyRichImportTargetField, string> = {
  audience: "audience",
  answer: "answer",
  deckDescription: "deckDescription",
  deckTitle: "deckTitle",
  draftConfidence: "draftConfidence",
  draftId: "draftId",
  draftWarnings: "draftWarnings",
  externalId: "externalId",
  hint: "hint",
  level: "level",
  question: "question",
  sourceChunkIds: "sourceChunkIds",
  sourceLabel: "sourceLabel",
  sourceNotes: "sourceNotes",
  sourcePackId: "sourcePackId",
  sourcePackTitle: "sourcePackTitle",
  sourcePages: "sourcePages",
  sourceUrl: "sourceUrl",
  sourceVisualAssetIds: "sourceVisualAssetIds",
  subject: "subject",
  tags: "tags",
  verificationConfidence: "verificationConfidence",
  verificationEvidence: "verificationEvidence",
  verificationNotes: "verificationNotes",
  verificationStatus: "verificationStatus",
  verifier: "verifier",
  isOfficial: "isOfficial",
  isVerified: "isVerified",
};

type StudyRichImportLevel = "advanced" | "beginner" | "intermediate";
type StudyRichVerificationStatus = "blocked" | "needs_review" | "ready_for_verifier" | "unverified" | "verified";

export type StudyRichImportNormalizedRow = {
  answer: string;
  audience?: string;
  deckDescription?: string;
  deckTitle?: string;
  draftConfidence?: number;
  draftId?: string;
  draftWarnings: string[];
  externalId?: string;
  hint?: string;
  level?: StudyRichImportLevel;
  question: string;
  isOfficial?: boolean;
  source: {
    sourceChunkIds: string[];
    sourceLabel?: string;
    sourceNotes?: string;
    sourcePackId?: string;
    sourcePackTitle?: string;
    sourcePages: number[];
    sourceUrl?: string;
    sourceVisualAssetIds: string[];
  };
  subject?: string;
  tags: string[];
  verification: {
    confidence?: number;
    evidence: string[];
    notes?: string;
    status?: StudyRichVerificationStatus;
    verifier?: string;
  };
};

export type StudyRichImportParseIssue = {
  message: string;
  row: number;
  severity: "error" | "warning";
};

export type StudyRichImportParseResult = {
  detectedHeaders: string[];
  delimiter: "," | "\t";
  effectiveMapping: Record<StudyRichImportTargetField, string>;
  errors: StudyRichImportParseIssue[];
  rowCount: number;
  rows: StudyRichImportNormalizedRow[];
  sourceCoverage: {
    sourcePackIds: string[];
    uniqueChunkIds: number;
    uniquePages: number;
    uniqueVisualAssetIds: number;
  };
  verificationStatusCounts: Partial<Record<StudyRichVerificationStatus, number>>;
  unmappedRequiredFields: StudyRichImportTargetField[];
  warnings: StudyRichImportParseIssue[];
};

export type StudyRichImportSaveResult = {
  createdCardCount: number;
  createdSourceCount: number;
  createdVerificationCount: number;
  deckImportId: string;
  deckId: string;
  rowsProcessed: number;
  verifiedCardCount: number;
};

function splitDelimitedField(value: string) {
  return value
    .split(/[|;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseList(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      return splitDelimitedField(trimmed.slice(1, -1));
    }
  }
  return splitDelimitedField(trimmed);
}

function parsePages(value: string) {
  const parts = parseList(value);
  const pages = new Set<number>();
  for (const part of parts) {
    const anchoredPageMatch = /(?:^|\b)page\s*=\s*(\d+)(?:\s*-\s*(\d+))?/i.exec(part);
    if (anchoredPageMatch) {
      const start = Number(anchoredPageMatch[1]);
      const end = Number(anchoredPageMatch[2] ?? anchoredPageMatch[1]);
      if (Number.isInteger(start) && Number.isInteger(end) && start > 0 && end >= start) {
        for (let page = start; page <= end; page += 1) pages.add(page);
      }
      continue;
    }
    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (Number.isInteger(start) && Number.isInteger(end) && start > 0 && end >= start) {
        for (let page = start; page <= end; page += 1) pages.add(page);
      }
      continue;
    }
    const page = Number(part);
    if (Number.isInteger(page) && page > 0) pages.add(page);
  }
  return Array.from(pages).sort((a, b) => a - b);
}

function parseCsvLike(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char === ",") {
      row.push(current);
      current = "";
      continue;
    }
    if (!inQuotes && char === "\n") {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }

  row.push(current);
  rows.push(row);
  return rows;
}

function parseTsv(text: string): string[][] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.split("\t"));
}

function normalizeLevel(value: string): StudyRichImportLevel | undefined {
  const lower = value.trim().toLowerCase();
  if (lower === "advanced" || lower === "beginner" || lower === "intermediate") return lower;
  return undefined;
}

function normalizeVerificationStatus(value: string): StudyRichVerificationStatus | undefined {
  const lower = value.trim().toLowerCase();
  if (
    lower === "blocked" ||
    lower === "needs_review" ||
    lower === "ready_for_verifier" ||
    lower === "unverified" ||
    lower === "verified"
  ) {
    return lower;
  }
  return undefined;
}

function parseConfidence(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.min(1, parsed));
}

function parseBooleanLike(value: string): boolean | undefined {
  const lower = value.trim().toLowerCase();
  if (!lower) return undefined;
  if (["1", "true", "yes", "y"].includes(lower)) return true;
  if (["0", "false", "no", "n"].includes(lower)) return false;
  return undefined;
}

function detectDelimiter(headerLine: string): "," | "\t" {
  return headerLine.includes("\t") ? "\t" : ",";
}

function normalizeHeader(value: string) {
  return value.trim().replace(/^\uFEFF/, "").toLowerCase().replace(/[\s_-]+/g, "");
}

function shouldVerifyCard(row: StudyRichImportNormalizedRow) {
  return (
    row.verification.status === "verified" &&
    typeof row.verification.confidence === "number" &&
    row.verification.confidence >= 0.8 &&
    Boolean(row.verification.verifier?.trim())
  );
}

function targetFieldAliases(target: StudyRichImportTargetField) {
  const aliases: Record<StudyRichImportTargetField, string[]> = {
    audience: ["audience"],
    answer: ["answer", "shortAnswer", "short_answer"],
    deckDescription: ["deckDescription", "deck_description", "version"],
    deckTitle: ["deckTitle", "deck_title", "examOrStandard", "exam_or_standard", "certification"],
    draftConfidence: ["draftConfidence", "draft_confidence"],
    draftId: ["draftId", "draft_id"],
    draftWarnings: ["draftWarnings", "draft_warnings"],
    externalId: ["externalId", "external_id", "card_id"],
    hint: ["hint", "explanation"],
    level: ["level"],
    question: ["question"],
    sourceChunkIds: ["sourceChunkIds", "source_chunk_ids"],
    sourceLabel: ["sourceLabel", "source_label", "officialReference", "official_reference"],
    sourceNotes: ["sourceNotes", "source_notes", "additionalReferences", "additional_references"],
    sourcePackId: ["sourcePackId", "source_pack_id", "examOrStandard", "exam_or_standard"],
    sourcePackTitle: ["sourcePackTitle", "source_pack_title", "certification", "version"],
    sourcePages: ["sourcePages", "source_pages", "source_page_anchors"],
    sourceUrl: ["sourceUrl", "source_url", "officialReferenceUrl", "official_reference_url"],
    sourceVisualAssetIds: ["sourceVisualAssetIds", "source_visual_asset_ids", "source_visual_ids"],
    subject: ["subject"],
    tags: ["tags"],
    verificationConfidence: ["verificationConfidence", "verification_confidence"],
    verificationEvidence: [
      "verificationEvidence",
      "verification_evidence",
      "additionalReferenceUrls",
      "additional_reference_urls",
    ],
    verificationNotes: ["verificationNotes", "verification_notes"],
    verificationStatus: ["verificationStatus", "verification_status"],
    verifier: ["verifier"],
    isOfficial: ["isOfficial", "official", "deckOfficial", "deck_official"],
    isVerified: ["isVerified", "verified", "cardVerified", "card_verified"],
  };
  return aliases[target];
}

function buildEffectiveMapping(args: {
  columnMapping?: StudyRichImportColumnMapping;
  normalizedHeaderLookup: Map<string, string>;
}) {
  const effective = { ...STUDY_RICH_IMPORT_DEFAULT_COLUMN_MAPPING };
  const provided = args.columnMapping ?? {};

  for (const key of STUDY_RICH_IMPORT_HEADERS) {
    const providedValue = provided[key];
    if (typeof providedValue === "string" && providedValue.trim()) {
      effective[key] = providedValue.trim();
    }
  }

  const requiredFields: StudyRichImportTargetField[] = ["question", "answer"];
  const unmappedRequiredFields = requiredFields.filter((field) => {
    const normalized = normalizeHeader(effective[field]);
    if (args.normalizedHeaderLookup.has(normalized)) {
      return false;
    }
    return !targetFieldAliases(field).some((alias) => args.normalizedHeaderLookup.has(normalizeHeader(alias)));
  });

  return {
    effective,
    unmappedRequiredFields,
  };
}

function readMappedValue(args: {
  effectiveMapping: Record<StudyRichImportTargetField, string>;
  headerIndex: Map<string, number>;
  row: string[];
  target: StudyRichImportTargetField;
}) {
  const mappedHeader = args.effectiveMapping[args.target];
  const mappedIndex = args.headerIndex.get(normalizeHeader(mappedHeader));
  if (mappedIndex !== undefined) {
    return (args.row[mappedIndex] ?? "").trim();
  }

  for (const alias of targetFieldAliases(args.target)) {
    const aliasIndex = args.headerIndex.get(normalizeHeader(alias));
    if (aliasIndex !== undefined) {
      return (args.row[aliasIndex] ?? "").trim();
    }
  }
  return "";
}

function hasDetectedHeader(headerIndex: Map<string, number>, aliases: string[]) {
  return aliases.some((alias) => headerIndex.has(normalizeHeader(alias)));
}

export function parseStudyRichFlashcardImportText(
  text: string,
  options?: { columnMapping?: StudyRichImportColumnMapping },
): StudyRichImportParseResult {
  const trimmed = text.trim();
  const errors: StudyRichImportParseIssue[] = [];
  const warnings: StudyRichImportParseIssue[] = [];

  if (!trimmed) {
    return {
      detectedHeaders: [],
      delimiter: ",",
      effectiveMapping: { ...STUDY_RICH_IMPORT_DEFAULT_COLUMN_MAPPING },
      errors: [{ message: "CSV/TSV text is empty.", row: 0, severity: "error" }],
      rowCount: 0,
      rows: [],
      sourceCoverage: { sourcePackIds: [], uniqueChunkIds: 0, uniquePages: 0, uniqueVisualAssetIds: 0 },
      verificationStatusCounts: {},
      unmappedRequiredFields: ["question", "answer"],
      warnings: [],
    };
  }

  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const matrix = delimiter === "\t" ? parseTsv(trimmed) : parseCsvLike(trimmed);
  const [headerRow, ...dataRows] = matrix;

  if (!headerRow || headerRow.length === 0) {
    return {
      detectedHeaders: [],
      delimiter,
      effectiveMapping: { ...STUDY_RICH_IMPORT_DEFAULT_COLUMN_MAPPING },
      errors: [{ message: "Header row is required.", row: 0, severity: "error" }],
      rowCount: 0,
      rows: [],
      sourceCoverage: { sourcePackIds: [], uniqueChunkIds: 0, uniquePages: 0, uniqueVisualAssetIds: 0 },
      verificationStatusCounts: {},
      unmappedRequiredFields: ["question", "answer"],
      warnings: [],
    };
  }

  const detectedHeaders = headerRow.map((value) => value.trim());
  const headers = headerRow.map(normalizeHeader);
  const headerIndex = new Map<string, number>(headers.map((header, index) => [header, index]));
  const normalizedHeaderLookup = new Map<string, string>();
  for (const header of detectedHeaders) {
    normalizedHeaderLookup.set(normalizeHeader(header), header);
  }
  const { effective, unmappedRequiredFields } = buildEffectiveMapping({
    columnMapping: options?.columnMapping,
    normalizedHeaderLookup,
  });
  for (const requiredField of unmappedRequiredFields) {
    errors.push({
      message: `Missing mapped required field '${requiredField}' (mapped to '${effective[requiredField]}').`,
      row: 0,
      severity: "error",
    });
  }

  const rows: StudyRichImportNormalizedRow[] = [];
  const sourcePackIds = new Set<string>();
  const chunkIds = new Set<string>();
  const pages = new Set<number>();
  const visualIds = new Set<string>();
  const verificationStatusCounts: Partial<Record<StudyRichVerificationStatus, number>> = {};

  for (let rowOffset = 0; rowOffset < dataRows.length; rowOffset += 1) {
    const rowNumber = rowOffset + 2;
    const row = dataRows[rowOffset];
    const getMappedValue = (target: StudyRichImportTargetField) =>
      readMappedValue({
        effectiveMapping: effective,
        headerIndex,
        row,
        target,
      });

    if (row.every((cell) => !cell || !cell.trim())) continue;

    const question = getMappedValue("question");
    const answer = getMappedValue("answer");
    if (!question) errors.push({ message: "Missing question.", row: rowNumber, severity: "error" });
    if (!answer) errors.push({ message: "Missing answer.", row: rowNumber, severity: "error" });
    if (!question || !answer) continue;

    const levelRaw = getMappedValue("level");
    const level = normalizeLevel(levelRaw);
    if (levelRaw && !level) {
      warnings.push({ message: `Unknown level '${levelRaw}' (ignored).`, row: rowNumber, severity: "warning" });
    }

    const verificationStatusRaw = getMappedValue("verificationStatus");
    const verificationStatus = normalizeVerificationStatus(verificationStatusRaw);
    if (verificationStatusRaw && !verificationStatus) {
      warnings.push({
        message: `Unknown verificationStatus '${verificationStatusRaw}' (ignored).`,
        row: rowNumber,
        severity: "warning",
      });
    }

    const draftConfidenceRaw = getMappedValue("draftConfidence");
    const draftConfidence = parseConfidence(draftConfidenceRaw);
    if (draftConfidenceRaw && draftConfidence === undefined) {
      warnings.push({
        message: `Invalid draftConfidence '${draftConfidenceRaw}' (ignored).`,
        row: rowNumber,
        severity: "warning",
      });
    }

    const verificationConfidenceRaw = getMappedValue("verificationConfidence");
    const verificationConfidence = parseConfidence(verificationConfidenceRaw);
    if (verificationConfidenceRaw && verificationConfidence === undefined) {
      warnings.push({
        message: `Invalid verificationConfidence '${verificationConfidenceRaw}' (ignored).`,
        row: rowNumber,
        severity: "warning",
      });
    }

    const isOfficialRaw = getMappedValue("isOfficial");
    const isOfficial = parseBooleanLike(isOfficialRaw);
    if (isOfficialRaw && isOfficial === undefined) {
      warnings.push({
        message: `Invalid isOfficial '${isOfficialRaw}' (ignored).`,
        row: rowNumber,
        severity: "warning",
      });
    }

    const isVerifiedRaw = getMappedValue("isVerified");
    const isVerified = parseBooleanLike(isVerifiedRaw);
    if (isVerifiedRaw && isVerified === undefined) {
      warnings.push({
        message: `Invalid isVerified '${isVerifiedRaw}' (ignored).`,
        row: rowNumber,
        severity: "warning",
      });
    }

    let resolvedVerificationStatus = verificationStatus;
    if (!resolvedVerificationStatus && isVerified === true) {
      resolvedVerificationStatus = "verified";
    }

    const sourceLabel = getMappedValue("sourceLabel") || undefined;
    const sourceUrl = getMappedValue("sourceUrl") || undefined;
    const inferredOfficialFromReference =
      !isOfficialRaw &&
      hasDetectedHeader(headerIndex, [
        "officialReference",
        "official_reference",
        "officialReferenceUrl",
        "official_reference_url",
      ]) &&
      Boolean(sourceLabel || sourceUrl);

    const normalizedRow: StudyRichImportNormalizedRow = {
      answer,
      audience: getMappedValue("audience") || undefined,
      deckDescription: getMappedValue("deckDescription") || undefined,
      deckTitle: getMappedValue("deckTitle") || undefined,
      draftConfidence,
      draftId: getMappedValue("draftId") || undefined,
      draftWarnings: parseList(getMappedValue("draftWarnings")),
      externalId: getMappedValue("externalId") || undefined,
      hint: getMappedValue("hint") || undefined,
      isOfficial: isOfficial ?? inferredOfficialFromReference,
      level,
      question,
      source: {
        sourceChunkIds: parseList(getMappedValue("sourceChunkIds")),
        sourceLabel,
        sourceNotes: getMappedValue("sourceNotes") || undefined,
        sourcePackId: getMappedValue("sourcePackId") || undefined,
        sourcePackTitle: getMappedValue("sourcePackTitle") || undefined,
        sourcePages: parsePages(getMappedValue("sourcePages")),
        sourceUrl,
        sourceVisualAssetIds: parseList(getMappedValue("sourceVisualAssetIds")),
      },
      subject: getMappedValue("subject") || undefined,
      tags: parseList(getMappedValue("tags")),
      verification: {
        confidence: verificationConfidence,
        evidence: parseList(getMappedValue("verificationEvidence")),
        notes: getMappedValue("verificationNotes") || undefined,
        status: resolvedVerificationStatus,
        verifier: getMappedValue("verifier") || undefined,
      },
    };

    if (normalizedRow.source.sourcePackId) sourcePackIds.add(normalizedRow.source.sourcePackId);
    for (const chunkId of normalizedRow.source.sourceChunkIds) chunkIds.add(chunkId);
    for (const page of normalizedRow.source.sourcePages) pages.add(page);
    for (const visualId of normalizedRow.source.sourceVisualAssetIds) visualIds.add(visualId);

    if (normalizedRow.verification.status) {
      verificationStatusCounts[normalizedRow.verification.status] =
        (verificationStatusCounts[normalizedRow.verification.status] ?? 0) + 1;
    }

    if (normalizedRow.verification.status === "verified" && !shouldVerifyCard(normalizedRow)) {
      warnings.push({
        message: "Row marked verified but does not meet import verification policy (status kept as metadata only).",
        row: rowNumber,
        severity: "warning",
      });
    }

    rows.push(normalizedRow);
  }

  return {
    detectedHeaders,
    delimiter,
    effectiveMapping: effective,
    errors,
    rowCount: rows.length,
    rows,
    sourceCoverage: {
      sourcePackIds: Array.from(sourcePackIds),
      uniqueChunkIds: chunkIds.size,
      uniquePages: pages.size,
      uniqueVisualAssetIds: visualIds.size,
    },
    verificationStatusCounts,
    unmappedRequiredFields,
    warnings,
  };
}

export async function saveStudyRichFlashcardImport(args: {
  adminUserId: string;
  deckId: string;
  markDeckOfficial?: boolean;
  rows: StudyRichImportNormalizedRow[];
}): Promise<StudyRichImportSaveResult> {
  return getDb().transaction(async (tx) => {
    const [deck] = await tx
      .select({ id: studyDecks.id })
      .from(studyDecks)
      .where(eq(studyDecks.id, args.deckId))
      .limit(1);

    if (!deck) {
      throw new Error("Deck not found.");
    }

    const [{ maxPosition }] = await tx
      .select({ maxPosition: sql<number>`coalesce(max(${studyCards.position}), -1)` })
      .from(studyCards)
      .where(eq(studyCards.deckId, args.deckId));

    const cardRows = args.rows.map((row, index) => {
      const verified = shouldVerifyCard(row);
      return {
        answer: row.answer,
        deckId: args.deckId,
        hint: row.hint ?? null,
        isVerified: verified,
        level: row.level ?? null,
        position: maxPosition + 1 + index,
        question: row.question,
        verifiedAt: verified ? new Date() : null,
        verifiedBy: verified ? `rich_csv:${row.verification.verifier}` : null,
      };
    });

    const cards = await tx.insert(studyCards).values(cardRows).returning({
      id: studyCards.id,
      isVerified: studyCards.isVerified,
    });

    const sourceRows = cards.flatMap((card, index) => {
      const source = args.rows[index].source;
      const hasSource =
        Boolean(source.sourceLabel) ||
        Boolean(source.sourceUrl) ||
        Boolean(source.sourcePackId) ||
        source.sourceChunkIds.length > 0 ||
        source.sourcePages.length > 0 ||
        source.sourceVisualAssetIds.length > 0;
      if (!hasSource) return [];
      const sourceLabelParts = [
        source.sourceLabel,
        source.sourcePackId ? `sourcePack=${source.sourcePackId}` : "",
        source.sourcePackTitle ? `sourcePackTitle=${source.sourcePackTitle}` : "",
        source.sourceChunkIds.length > 0 ? `chunks=${source.sourceChunkIds.join(",")}` : "",
        source.sourcePages.length > 0 ? `pages=${source.sourcePages.join(",")}` : "",
        source.sourceVisualAssetIds.length > 0 ? `visuals=${source.sourceVisualAssetIds.join(",")}` : "",
        source.sourceNotes ? `notes=${source.sourceNotes}` : "",
      ].filter(Boolean);
      const generatedSourceLabel = sourceLabelParts.length > 0 ? sourceLabelParts.join(" | ") : undefined;

      return [
        {
          cardId: card.id,
        sourceMetadata: {
            audience: args.rows[index].audience ?? null,
            deckDescription: args.rows[index].deckDescription ?? null,
            deckTitle: args.rows[index].deckTitle ?? null,
            draftConfidence: args.rows[index].draftConfidence ?? null,
            draftId: args.rows[index].draftId ?? null,
            draftWarnings: args.rows[index].draftWarnings,
            externalId: args.rows[index].externalId ?? null,
            sourceChunkIds: source.sourceChunkIds,
            sourceNotes: source.sourceNotes ?? null,
            sourcePackId: source.sourcePackId ?? null,
            sourcePackTitle: source.sourcePackTitle ?? null,
            sourcePages: source.sourcePages,
            sourceVisualAssetIds: source.sourceVisualAssetIds,
            subject: args.rows[index].subject ?? null,
            tags: args.rows[index].tags,
          },
          sourceLabel: generatedSourceLabel ?? null,
          sourceType: source.sourcePackId ? "source_pack_csv" : source.sourceUrl ? "url_csv" : "csv",
          sourceUrl: source.sourceUrl ?? null,
        },
      ];
    });

    if (sourceRows.length > 0) {
      await tx.insert(studyCardSources).values(sourceRows);
    }

    const verificationRows = cards.flatMap((card, index) => {
      const verification = args.rows[index].verification;
      const hasVerificationMetadata =
        Boolean(verification.status) ||
        typeof verification.confidence === "number" ||
        Boolean(verification.notes) ||
        verification.evidence.length > 0 ||
        Boolean(verification.verifier);
      if (!hasVerificationMetadata) return [];
      const noteParts = [
        verification.status ? `status=${verification.status}` : "",
        verification.verifier ? `verifier=${verification.verifier}` : "",
        args.rows[index].subject ? `subject=${args.rows[index].subject}` : "",
        args.rows[index].audience ? `audience=${args.rows[index].audience}` : "",
        args.rows[index].tags.length > 0 ? `tags=${args.rows[index].tags.join(" | ")}` : "",
        typeof args.rows[index].draftConfidence === "number" ? `draftConfidence=${args.rows[index].draftConfidence}` : "",
        args.rows[index].draftWarnings.length > 0 ? `draftWarnings=${args.rows[index].draftWarnings.join(" | ")}` : "",
        args.rows[index].draftId ? `draftId=${args.rows[index].draftId}` : "",
        args.rows[index].externalId ? `externalId=${args.rows[index].externalId}` : "",
        verification.notes ? `notes=${verification.notes}` : "",
        verification.evidence.length > 0 ? `evidence=${verification.evidence.join(" | ")}` : "",
      ].filter(Boolean);
      return [
        {
          cardId: card.id,
          confidence: verification.confidence ?? null,
          evidence: verification.evidence.length > 0 ? verification.evidence : null,
          note: noteParts.join("\n"),
          verificationStatus: verification.status ?? null,
          verifier: verification.verifier ?? null,
          verifiedByUserId: card.isVerified ? args.adminUserId : null,
        },
      ];
    });

    if (verificationRows.length > 0) {
      await tx.insert(studyVerifications).values(verificationRows);
    }

    const uniqueSourcePacks = Array.from(new Set(args.rows.map((row) => row.source.sourcePackId).filter(Boolean)));
    const [deckImport] = await tx.insert(studyDeckImports).values({
      deckId: args.deckId,
      importType: "rich_admin_csv",
      sourceCount: args.rows.length,
      sourceSummary: `rich_csv rows=${args.rows.length}; sourcePacks=${uniqueSourcePacks.join(",") || "none"}`,
      userId: args.adminUserId,
    }).returning({ id: studyDeckImports.id });

    await tx
      .update(studyDecks)
      .set({
        cardCount: sql`greatest(${studyDecks.cardCount} + ${args.rows.length}, 0)`,
        ...(args.markDeckOfficial ? { isOfficial: true } : {}),
        updatedAt: new Date(),
        verifiedCardCount: sql`(
          select count(*)::int
          from ${studyCards}
          where ${studyCards.deckId} = ${args.deckId}
            and ${studyCards.isVerified} = true
        )`,
      })
      .where(eq(studyDecks.id, args.deckId));

    return {
      createdCardCount: cards.length,
      createdSourceCount: sourceRows.length,
      createdVerificationCount: verificationRows.length,
      deckId: args.deckId,
      deckImportId: deckImport.id,
      rowsProcessed: args.rows.length,
      verifiedCardCount: cards.filter((card) => card.isVerified).length,
    };
  });
}

export const STUDY_RICH_IMPORT_SAMPLE_CSV = [
  STUDY_RICH_IMPORT_HEADERS.join(","),
  "row-001,Rich CSV Sample Import,Imported through Study Admin CSV.,Flight Fundamentals,Private Pilot,What is the purpose of trim?,To relieve control pressure in steady flight.,Set pitch first then trim.,beginner,fundamentals|flight-controls,sample-source-pack,Sample Source Pack,chunk-001|chunk-002,12|13,figure-12-a,PHAK chapter 4,https://example.com/phak/ch4,Use with source-linked context,draft-001,0.86,needs_review_pass,verified,0.91,Grounded in chunk evidence,chunk-001 line 3|chunk-002 line 1,admin_reviewer,true,true",
  "row-002,Rich CSV Sample Import,Imported through Study Admin CSV.,Flight Fundamentals,Private Pilot,When should confidence be reduced?,When source evidence is missing or contradictory.,Check source anchors first.,intermediate,verification|quality,sample-source-pack,Sample Source Pack,chunk-010,18-19,,Review Notes,,Needs human follow-up,draft-001,0.62,needs_human_review,needs_review,0.62,Needs human follow-up,chunk-010 summary,admin_reviewer,true,false",
].join("\n");
