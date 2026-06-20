import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { and, count, eq, inArray } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { dpeConcepts, dpeQuestionVariants } from "@/server/db/schema";
import {
  dpeConceptVariantModes,
  parseDpeConceptPacket,
  upsertDpeConceptPacket,
  type DpeConceptPacket,
} from "@/server/dpe/concept-content";

type ImportFile = {
  certificateId: string;
  expectedConcepts: number;
  label: string;
  path: string;
};

type RawConceptPacket = {
  certificate?: { id?: unknown };
  concept?: { id?: unknown };
  variants?: Record<string, unknown>;
};

const importFiles: ImportFile[] = [
  {
    certificateId: "private-pilot-asel",
    expectedConcepts: 294,
    label: "Private Pilot ASEL",
    path:
      "E:\\Codex\\QuesIQ\\QuesIQ Content Management\\QuesIQ Content Library\\artifacts\\imports\\_status\\01-ready-to-import\\dpe\\private-pilot-asel-v2-drill-clean-import-option-2026-06-19\\private-pilot-asel-v2-drill-clean-import-option-2026-06-19.json",
  },
  {
    certificateId: "instrument-rating-airplane",
    expectedConcepts: 266,
    label: "Instrument Rating Airplane",
    path:
      "E:\\Codex\\QuesIQ\\QuesIQ Content Management\\QuesIQ Content Library\\artifacts\\imports\\_status\\01-ready-to-import\\dpe\\instrument-rating-airplane-v2-drill-clean-import-option-2026-06-19\\instrument-rating-airplane-v2-drill-clean-import-option-2026-06-19.json",
  },
];

const heldReviewDir =
  "E:\\Codex\\QuesIQ\\QuesIQ Content Management\\QuesIQ Content Library\\artifacts\\imports\\_status\\02-needs-fact-verification\\dpe\\dpe-v2-drill-held-for-later-review-2026-06-19";

const requiredModes = [...dpeConceptVariantModes].sort();
const dryRun = process.argv.includes("--dry-run");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

function getConceptPackets(filePath: string) {
  const parsed = readJson(filePath) as { conceptPackets?: unknown[] };
  assert(Array.isArray(parsed.conceptPackets), `${filePath} must contain conceptPackets[]`);
  return parsed.conceptPackets as RawConceptPacket[];
}

function tryGetConceptPackets(filePath: string) {
  const parsed = readJson(filePath) as { conceptPackets?: unknown[] };
  return Array.isArray(parsed.conceptPackets) ? (parsed.conceptPackets as RawConceptPacket[]) : null;
}

function conceptId(packet: RawConceptPacket, fallback: string) {
  return typeof packet.concept?.id === "string" && packet.concept.id.trim()
    ? packet.concept.id.trim()
    : fallback;
}

function validateImportFile(file: ImportFile) {
  assert(file.path.includes("01-ready-to-import"), `${file.label} path is not in 01-ready-to-import`);
  assert(!file.path.includes("02-needs-fact-verification"), `${file.label} path points to held review content`);
  assert(file.path.includes("2026-06-19"), `${file.label} path is not a 2026-06-19 clean import option`);
  assert(!file.path.includes("2026-06-18"), `${file.label} path points to superseded 2026-06-18 content`);

  const packets = getConceptPackets(file.path);
  const seenIds = new Set<string>();
  const parsedPackets: DpeConceptPacket[] = [];
  const failures: Array<{ error: string; id: string }> = [];
  const duplicateIds: string[] = [];
  const modeFailures: Array<{ id: string; modes: string[] }> = [];
  const scenarioOrMockIds: string[] = [];
  const multipleChoiceFailures: Array<{ choices: number | string; correctChoiceIds: number | string; id: string }> = [];

  for (const [index, packet] of packets.entries()) {
    const id = conceptId(packet, `index-${index}`);
    if (seenIds.has(id)) duplicateIds.push(id);
    seenIds.add(id);

    assert(
      packet.certificate?.id === file.certificateId,
      `${file.label} packet ${id} has certificate ${String(packet.certificate?.id)}`,
    );

    if (packet.variants?.scenario !== undefined || packet.variants?.mock_oral !== undefined) {
      scenarioOrMockIds.push(id);
    }

    const modes = Object.keys(packet.variants ?? {}).sort();
    if (JSON.stringify(modes) !== JSON.stringify(requiredModes)) {
      modeFailures.push({ id, modes });
    }

    const multipleChoice = packet.variants?.multiple_choice as
      | { choices?: unknown; correctChoiceIds?: unknown }
      | undefined;
    const choicesCount = Array.isArray(multipleChoice?.choices)
      ? multipleChoice.choices.length
      : typeof multipleChoice?.choices;
    const correctChoiceCount = Array.isArray(multipleChoice?.correctChoiceIds)
      ? multipleChoice.correctChoiceIds.length
      : typeof multipleChoice?.correctChoiceIds;
    if (choicesCount !== 4 || correctChoiceCount !== 1) {
      multipleChoiceFailures.push({ choices: choicesCount, correctChoiceIds: correctChoiceCount, id });
    }

    const parsed = parseDpeConceptPacket(packet);
    if (parsed.ok) {
      parsedPackets.push(parsed.value);
    } else {
      failures.push({ error: parsed.error, id });
    }
  }

  assert(packets.length === file.expectedConcepts, `${file.label} expected ${file.expectedConcepts}, found ${packets.length}`);
  assert(failures.length === 0, `${file.label} parser failures: ${JSON.stringify(failures.slice(0, 5))}`);
  assert(duplicateIds.length === 0, `${file.label} duplicate concept IDs: ${duplicateIds.slice(0, 10).join(", ")}`);
  assert(modeFailures.length === 0, `${file.label} mode failures: ${JSON.stringify(modeFailures.slice(0, 5))}`);
  assert(scenarioOrMockIds.length === 0, `${file.label} includes scenario/mock_oral variants: ${scenarioOrMockIds.slice(0, 10).join(", ")}`);
  assert(
    multipleChoiceFailures.length === 0,
    `${file.label} multiple-choice shape failures: ${JSON.stringify(multipleChoiceFailures.slice(0, 5))}`,
  );

  return {
    conceptIds: [...seenIds],
    parsedPackets,
    parsed: parsedPackets.length,
    sourcePackets: packets.length,
  };
}

function readHeldConceptIds() {
  if (!existsSync(heldReviewDir)) return [];

  const ids = new Set<string>();
  for (const entry of readdirSync(heldReviewDir)) {
    if (!entry.endsWith(".json")) continue;
    const filePath = path.join(heldReviewDir, entry);
    const body = readJson(filePath) as { heldConcepts?: Array<{ conceptId?: unknown }> };
    if (Array.isArray(body.heldConcepts)) {
      for (const [index, held] of body.heldConcepts.entries()) {
        ids.add(typeof held.conceptId === "string" && held.conceptId.trim() ? held.conceptId.trim() : `${entry}:held-${index}`);
      }
      continue;
    }

    const packets = tryGetConceptPackets(filePath);
    if (!packets) continue;
    for (const [index, packet] of packets.entries()) {
      ids.add(conceptId(packet, `${entry}:index-${index}`));
    }
  }
  return [...ids];
}

async function verifyDatabase(importedIds: string[]) {
  const db = getDb();
  const certificateCounts: Record<string, { concepts: number; variants: number }> = {};

  for (const file of importFiles) {
    const [conceptResult] = await db
      .select({ count: count() })
      .from(dpeConcepts)
      .where(and(eq(dpeConcepts.certificateTypeId, file.certificateId), eq(dpeConcepts.active, true)));
    const [variantResult] = await db
      .select({ count: count() })
      .from(dpeQuestionVariants)
      .innerJoin(dpeConcepts, eq(dpeConcepts.id, dpeQuestionVariants.conceptId))
      .where(and(eq(dpeConcepts.certificateTypeId, file.certificateId), eq(dpeQuestionVariants.active, true)));
    certificateCounts[file.certificateId] = {
      concepts: conceptResult?.count ?? 0,
      variants: variantResult?.count ?? 0,
    };
  }

  const variantRows = await db
    .select({
      choices: dpeQuestionVariants.choicesJson,
      conceptId: dpeQuestionVariants.conceptId,
      correctChoiceIds: dpeQuestionVariants.correctChoiceIds,
      mode: dpeQuestionVariants.mode,
    })
    .from(dpeQuestionVariants)
    .where(inArray(dpeQuestionVariants.conceptId, importedIds));

  const modesByConcept = new Map<string, Set<string>>();
  const multipleChoiceFailures: Array<{ choices: number | string; correctChoiceIds: number | string; id: string }> = [];
  for (const row of variantRows) {
    const modes = modesByConcept.get(row.conceptId) ?? new Set<string>();
    modes.add(row.mode);
    modesByConcept.set(row.conceptId, modes);

    if (row.mode === "multiple_choice") {
      const choicesCount = Array.isArray(row.choices) ? row.choices.length : typeof row.choices;
      const correctChoiceCount = Array.isArray(row.correctChoiceIds) ? row.correctChoiceIds.length : typeof row.correctChoiceIds;
      if (choicesCount !== 4 || correctChoiceCount !== 1) {
        multipleChoiceFailures.push({ choices: choicesCount, correctChoiceIds: correctChoiceCount, id: row.conceptId });
      }
    }
  }

  const missingModeConcepts = importedIds
    .map((id) => ({ id, modes: [...(modesByConcept.get(id) ?? new Set<string>())].sort() }))
    .filter((row) => JSON.stringify(row.modes) !== JSON.stringify(requiredModes));

  const heldIds = readHeldConceptIds();
  const heldRows =
    heldIds.length > 0
      ? await db.select({ id: dpeConcepts.id }).from(dpeConcepts).where(inArray(dpeConcepts.id, heldIds))
      : [];

  for (const file of importFiles) {
    const countsForCert = certificateCounts[file.certificateId];
    assert(
      countsForCert.concepts === file.expectedConcepts,
      `${file.label} DB concept count expected ${file.expectedConcepts}, got ${countsForCert.concepts}`,
    );
    assert(
      countsForCert.variants === file.expectedConcepts * requiredModes.length,
      `${file.label} DB variant count expected ${file.expectedConcepts * requiredModes.length}, got ${countsForCert.variants}`,
    );
  }
  assert(missingModeConcepts.length === 0, `Imported concepts missing modes: ${JSON.stringify(missingModeConcepts.slice(0, 5))}`);
  assert(
    multipleChoiceFailures.length === 0,
    `Imported multiple-choice variants failed shape checks: ${JSON.stringify(multipleChoiceFailures.slice(0, 5))}`,
  );
  assert(heldRows.length === 0, `Held/later-review concepts unexpectedly present in DB: ${heldRows.map((row) => row.id).join(", ")}`);

  return {
    certificateCounts,
    heldChecked: heldIds.length,
    heldImported: heldRows.length,
    importedConcepts: importedIds.length,
    importedVariants: variantRows.length,
    missingModeConcepts: missingModeConcepts.length,
    multipleChoiceFailures: multipleChoiceFailures.length,
  };
}

async function main() {
  const allPackets: DpeConceptPacket[] = [];
  const allIds: string[] = [];
  const validations = [];

  for (const file of importFiles) {
    const validation = validateImportFile(file);
    validations.push({
      expected: file.expectedConcepts,
      failures: 0,
      label: file.label,
      parsed: validation.parsed,
      sourcePackets: validation.sourcePackets,
    });
    allPackets.push(...validation.parsedPackets);
    allIds.push(...validation.conceptIds);
  }

  const importSummary = { imported: 0, skipped: 0, updatedOrCreated: 0 };
  if (!dryRun) {
    for (const packet of allPackets) {
      await upsertDpeConceptPacket(packet);
      importSummary.imported += 1;
      importSummary.updatedOrCreated += 1;
    }
  } else {
    importSummary.skipped = allPackets.length;
  }

  const verification = dryRun ? null : await verifyDatabase(allIds);
  console.log(
    JSON.stringify(
      {
        dryRun,
        importFiles: importFiles.map((file) => ({ label: file.label, path: file.path })),
        importSummary,
        requiredModes,
        validations,
        verification,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
