import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { and, asc, count, eq, inArray, notInArray, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  studyCardSources,
  studyCards,
  studyDeckStackItems,
  studyDeckStacks,
  studyDecks,
  studyVerifications,
} from "@/server/db/schema";
import {
  parseStudyRichFlashcardImportText,
  type StudyRichImportNormalizedRow,
} from "@/server/study/study-rich-flashcard-import";

const readyRoot =
  "E:\\Codex\\QuesIQ\\QuesIQ Content Management\\QuesIQ Content Library\\artifacts\\imports\\_status\\01-ready-to-import";
const studyReadyRoot = path.join(readyRoot, "study");
const reportsRoot =
  "E:\\Codex\\QuesIQ\\QuesIQ Content Management\\QuesIQ Content Library\\artifacts\\imports\\_status\\_reports\\study-local-import-2026-06-20";

const dryRun = process.argv.includes("--dry-run");
const writeReport = process.argv.includes("--write-report");
const expectedImportRows = 7908;
const expectedPrivatePilotRows = 516;
const expectedPrivatePilotDecks = 22;

const allowedPacketRoots = [
  "aviation\\ifr-expanded-official-stack",
  "it\\comptia-security-plus-sy0-701-expanded-needs-source-verification-2026-06-13",
  "next-study-decks-2026-06-19",
  "private-pilot\\private-pilot-acs-expanded-official-stack",
  "real-estate\\real-estate-national-core-salesperson-expanded-2026-06-14",
  "real-estate\\texas-sales-agent-state-delta-expanded-2026-06-14",
];

const forbiddenPathPattern =
  /(?:^|[\\/])(?:02-needs-fact-verification|03-needs-structural-cleanup|04-review-only-not-for-import|05-deprecated-superseded|06-needs-initial-qa|07-needs-expert-review)(?:[\\/]|$)/i;
const skippedSupportPattern =
  /quarantine|support|audit|url-live-check|link-audit|remediation|supersession|map/i;
const importNamePattern =
  /(study-admin|import-ready|SecPlus_|Real_Estate_|TX_Sales_)/i;

const stackDefinitions = [
  {
    description: "Local-only Private Pilot ACS Study stack imported from 2026-06-19 ready content.",
    prefixes: ["private-pilot/private-pilot-acs-expanded-official-stack/"],
    subject: "Aviation",
    title: "Private Pilot ACS Expanded Official Stack",
  },
  {
    description: "Local-only Instrument Rating Study stack imported from 2026-06-19 ready content.",
    prefixes: ["aviation/ifr-expanded-official-stack/"],
    subject: "Aviation",
    title: "Instrument Rating Airplane Expanded Official Stack",
  },
  {
    description: "Local-only CompTIA Security+ SY0-701 Study stack imported from ready content.",
    prefixes: ["it/comptia-security-plus-sy0-701-expanded-needs-source-verification-2026-06-13/"],
    subject: "Information Technology",
    title: "CompTIA Security+ SY0-701 Expanded Study Stack",
  },
  {
    description: "Local-only national real estate salesperson Study stack imported from ready content.",
    prefixes: ["real-estate/real-estate-national-core-salesperson-expanded-2026-06-14/"],
    subject: "Real Estate",
    title: "Real Estate National Core Salesperson Expanded Study Stack",
  },
  {
    description: "Local-only Texas sales agent delta Study stack imported from ready content.",
    prefixes: ["real-estate/texas-sales-agent-state-delta-expanded-2026-06-14/"],
    subject: "Real Estate",
    title: "Texas Sales Agent State Delta Expanded Study Stack",
  },
] as const;

type ImportRow = {
  file: string;
  fileRow: number;
  row: StudyRichImportNormalizedRow;
};

type DeckPlan = {
  deckDescription: string | null;
  rows: ImportRow[];
  subject: string | null;
  tags: string[];
  title: string;
};

type StackPlan = {
  deckTitles: string[];
  description: string;
  subject: string;
  title: string;
};

type ExistingExternalCard = {
  cardId: string;
  deckId: string;
  deckTitle: string;
  externalId: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function toRelativeStudyPath(filePath: string) {
  return path.relative(studyReadyRoot, filePath).replaceAll("\\", "/");
}

function walkFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    return statSync(fullPath).isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function isInsideReadyLane(filePath: string) {
  const normalized = path.resolve(filePath).toLowerCase();
  return normalized.startsWith(path.resolve(readyRoot).toLowerCase() + path.sep.toLowerCase());
}

function isAllowedPacket(filePath: string) {
  const relative = path.relative(studyReadyRoot, filePath);
  return allowedPacketRoots.some((root) => {
    const normalizedRoot = root.toLowerCase();
    const normalizedRelative = relative.toLowerCase();
    return normalizedRelative === normalizedRoot || normalizedRelative.startsWith(`${normalizedRoot}\\`);
  });
}

function isStudyImportInput(filePath: string) {
  if (!filePath.toLowerCase().endsWith(".csv")) return false;
  if (!isInsideReadyLane(filePath)) return false;
  if (forbiddenPathPattern.test(filePath)) return false;
  if (!isAllowedPacket(filePath)) return false;
  if (/healthcare[\\/]nclex-rn-pn-final-all-source-remediated-canonical-2026-06-13/i.test(filePath)) return false;
  const relative = toRelativeStudyPath(filePath);
  if (skippedSupportPattern.test(relative)) return false;
  return importNamePattern.test(relative);
}

function classifySkippedFile(filePath: string) {
  const relative = toRelativeStudyPath(filePath);
  if (!filePath.toLowerCase().endsWith(".csv")) return "not_csv";
  if (/healthcare[\\/]nclex-rn-pn-final-all-source-remediated-canonical-2026-06-13/i.test(filePath)) {
    return "nclex_canonical_membership_blocked";
  }
  if (skippedSupportPattern.test(relative)) return "support_or_quarantine";
  if (!isAllowedPacket(filePath)) return "outside_allowed_ready_packets";
  if (!importNamePattern.test(relative)) return "not_import_input_name";
  return "selected";
}

function normalizeDeckTitle(row: StudyRichImportNormalizedRow, file: string) {
  return row.deckTitle?.trim() || row.subject?.trim() || path.basename(file, path.extname(file));
}

function normalizeDeckDescription(row: StudyRichImportNormalizedRow) {
  return row.deckDescription?.trim() || null;
}

function normalizeDeckSubject(row: StudyRichImportNormalizedRow) {
  return row.subject?.trim() || row.certification?.trim() || null;
}

function sortedUnique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function buildVerificationNote(row: StudyRichImportNormalizedRow) {
  const parts = [
    row.verification.status ? `status=${row.verification.status}` : "",
    row.verification.verifier ? `verifier=${row.verification.verifier}` : "",
    row.verification.notes ? `notes=${row.verification.notes}` : "",
    row.verification.evidence.length > 0 ? `evidence=${row.verification.evidence.join(" | ")}` : "",
    row.externalId ? `externalId=${row.externalId}` : "",
    row.industry ? `industry=${row.industry}` : "",
    row.role ? `role=${row.role}` : "",
    row.certification ? `certification=${row.certification}` : "",
    row.examOrStandard ? `examOrStandard=${row.examOrStandard}` : "",
    row.version ? `version=${row.version}` : "",
    row.subject ? `subject=${row.subject}` : "",
    row.topic ? `topic=${row.topic}` : "",
    row.audience ? `audience=${row.audience}` : "",
    row.tags.length > 0 ? `tags=${row.tags.join(" | ")}` : "",
  ].filter(Boolean);
  return parts.join("\n") || null;
}

function buildSourceMetadata(row: StudyRichImportNormalizedRow, file: string, fileRow: number) {
  return {
    additionalReferenceLabels: row.source.additionalReferenceLabels,
    additionalReferenceUrls: row.source.additionalReferenceUrls,
    audience: row.audience ?? null,
    certification: row.certification ?? null,
    deckDescription: row.deckDescription ?? null,
    deckTitle: row.deckTitle ?? null,
    draftConfidence: row.draftConfidence ?? null,
    draftId: row.draftId ?? null,
    draftWarnings: row.draftWarnings,
    examOrStandard: row.examOrStandard ?? null,
    expertReview: {
      date: null,
      notes: null,
      reviewer: null,
      status: null,
      type: null,
    },
    externalId: row.externalId ?? null,
    importFile: toRelativeStudyPath(file),
    importFileRow: fileRow,
    importPolicy: {
      appSideVerifiedForcedFalse: true,
      expertReviewedForcedFalse: true,
      officialForcedFalse: true,
      publicForcedFalse: true,
    },
    industry: row.industry ?? null,
    referenceNote: row.source.referenceNote ?? null,
    role: row.role ?? null,
    rawFields: row.rawFields,
    sourceChunkIds: row.source.sourceChunkIds,
    sourceNotes: row.source.sourceNotes ?? null,
    sourcePackId: row.source.sourcePackId ?? null,
    sourcePackTitle: row.source.sourcePackTitle ?? null,
    sourcePages: row.source.sourcePages,
    sourceVisualAssetIds: row.source.sourceVisualAssetIds,
    subject: row.subject ?? null,
    tags: row.tags,
    topic: row.topic ?? null,
    verification: {
      confidence: row.verification.confidence ?? null,
      evidence: row.verification.evidence,
      notes: row.verification.notes ?? null,
      status: row.verification.status ?? null,
      verifier: row.verification.verifier ?? null,
    },
    version: row.version ?? null,
  };
}

function parseImportRows(files: string[]) {
  const rows: ImportRow[] = [];
  const fileSummaries: Array<{ errors: number; file: string; rows: number; warnings: number }> = [];

  for (const file of files) {
    const parsed = parseStudyRichFlashcardImportText(readFileSync(file, "utf8"));
    fileSummaries.push({
      errors: parsed.errors.length,
      file: toRelativeStudyPath(file),
      rows: parsed.rowCount,
      warnings: parsed.warnings.length,
    });
    assert(
      parsed.errors.length === 0,
      `${toRelativeStudyPath(file)} has parser errors: ${JSON.stringify(parsed.errors.slice(0, 5))}`,
    );
    parsed.rows.forEach((row, index) => {
      assert(row.externalId?.trim(), `${toRelativeStudyPath(file)} row ${index + 2} has no externalId`);
      rows.push({ file, fileRow: index + 2, row });
    });
  }

  return { fileSummaries, rows };
}

function buildDeckPlans(rows: ImportRow[]) {
  const plans = new Map<string, DeckPlan>();
  for (const importRow of rows) {
    const title = normalizeDeckTitle(importRow.row, importRow.file);
    const existing = plans.get(title);
    if (!existing) {
      plans.set(title, {
        deckDescription: normalizeDeckDescription(importRow.row),
        rows: [importRow],
        subject: normalizeDeckSubject(importRow.row),
        tags: [...importRow.row.tags],
        title,
      });
      continue;
    }
    existing.rows.push(importRow);
    existing.tags.push(...importRow.row.tags);
    existing.tags = sortedUnique(existing.tags);
    existing.deckDescription ??= normalizeDeckDescription(importRow.row);
    existing.subject ??= normalizeDeckSubject(importRow.row);
  }
  return [...plans.values()].sort((left, right) => left.title.localeCompare(right.title));
}

function buildStackPlans(deckPlans: DeckPlan[]) {
  const plans: StackPlan[] = [];
  for (const definition of stackDefinitions) {
    const deckTitles = deckPlans
      .filter((deckPlan) =>
        deckPlan.rows.some((row) => {
          const relative = toRelativeStudyPath(row.file);
          return definition.prefixes.some((prefix) => relative.startsWith(prefix));
        }),
      )
      .map((deckPlan) => deckPlan.title)
      .sort((left, right) => left.localeCompare(right));

    if (deckTitles.length > 0) {
      plans.push({
        deckTitles,
        description: definition.description,
        subject: definition.subject,
        title: definition.title,
      });
    }
  }
  return plans;
}

function privatePilotDeckTitles(plans: DeckPlan[]) {
  return plans
    .filter((plan) =>
      plan.rows.some((row) =>
        toRelativeStudyPath(row.file).startsWith("private-pilot/private-pilot-acs-expanded-official-stack/"),
      ),
    )
    .map((plan) => plan.title)
    .sort((left, right) => left.localeCompare(right));
}

async function getReplacementDecks(titles: string[]) {
  if (titles.length === 0) return [];
  const decks = await getDb()
    .select({
      cardCount: studyDecks.cardCount,
      id: studyDecks.id,
      isOfficial: studyDecks.isOfficial,
      isPublic: studyDecks.isPublic,
      title: studyDecks.title,
      verifiedCardCount: studyDecks.verifiedCardCount,
    })
    .from(studyDecks)
    .where(inArray(studyDecks.title, titles))
    .orderBy(asc(studyDecks.title));
  const deckIds = decks.map((deck) => deck.id);
  const cardCounts =
    deckIds.length > 0
      ? await getDb()
          .select({ cards: count(studyCards.id), deckId: studyCards.deckId })
          .from(studyCards)
          .where(inArray(studyCards.deckId, deckIds))
          .groupBy(studyCards.deckId)
      : [];
  const countMap = new Map(cardCounts.map((row) => [row.deckId, row.cards]));
  return decks.map((deck) => ({ ...deck, actualCards: countMap.get(deck.id) ?? 0 }));
}

async function getExistingExternalCards(externalIds: string[], excludingDeckIds: string[] = []) {
  if (externalIds.length === 0) return [];
  const externalIdSql = sql<string>`${studyCardSources.sourceMetadata}->>'externalId'`;
  const rows = await getDb()
    .select({
      cardId: studyCards.id,
      deckId: studyCards.deckId,
      deckTitle: studyDecks.title,
      externalId: externalIdSql,
    })
    .from(studyCards)
    .innerJoin(studyCardSources, eq(studyCardSources.cardId, studyCards.id))
    .innerJoin(studyDecks, eq(studyDecks.id, studyCards.deckId))
    .where(
      and(
        inArray(externalIdSql, externalIds),
        excludingDeckIds.length > 0 ? notInArray(studyCards.deckId, excludingDeckIds) : undefined,
      ),
    )
    .orderBy(externalIdSql, studyCards.id);
  return rows;
}

function groupDuplicateExternalIds(rows: ExistingExternalCard[]) {
  const map = new Map<string, ExistingExternalCard[]>();
  for (const row of rows) {
    const list = map.get(row.externalId) ?? [];
    list.push(row);
    map.set(row.externalId, list);
  }
  return [...map.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([externalId, items]) => ({ externalId, items }));
}

async function upsertDeck(plan: DeckPlan) {
  const [existing] = await getDb()
    .select({ id: studyDecks.id })
    .from(studyDecks)
    .where(eq(studyDecks.title, plan.title))
    .limit(1);
  const values = {
    cardCount: plan.rows.length,
    description: plan.deckDescription,
    isOfficial: false,
    isPublic: false,
    subject: plan.subject,
    tags: plan.tags.length > 0 ? plan.tags : null,
    title: plan.title,
    updatedAt: new Date(),
    verifiedCardCount: 0,
  };
  if (existing) {
    const [deck] = await getDb()
      .update(studyDecks)
      .set(values)
      .where(eq(studyDecks.id, existing.id))
      .returning({ id: studyDecks.id });
    return deck.id;
  }
  const [deck] = await getDb()
    .insert(studyDecks)
    .values({
      ...values,
      userId: null,
    })
    .returning({ id: studyDecks.id });
  return deck.id;
}

async function upsertStack(plan: StackPlan, deckIdsByTitle: Map<string, string>) {
  const deckIds = plan.deckTitles.map((title) => deckIdsByTitle.get(title));
  assert(
    deckIds.every((deckId): deckId is string => Boolean(deckId)),
    `Stack '${plan.title}' is missing deck ids for: ${plan.deckTitles
      .filter((title) => !deckIdsByTitle.has(title))
      .join(", ")}`,
  );

  const values = {
    description: plan.description,
    isOfficial: false,
    isPublic: false,
    subject: plan.subject,
    title: plan.title,
    updatedAt: new Date(),
    userId: null,
  };
  const [existing] = await getDb()
    .select({ id: studyDeckStacks.id })
    .from(studyDeckStacks)
    .where(eq(studyDeckStacks.title, plan.title))
    .limit(1);

  const stackId = existing
    ? (
        await getDb()
          .update(studyDeckStacks)
          .set(values)
          .where(eq(studyDeckStacks.id, existing.id))
          .returning({ id: studyDeckStacks.id })
      )[0].id
    : (
        await getDb()
          .insert(studyDeckStacks)
          .values(values)
          .returning({ id: studyDeckStacks.id })
      )[0].id;

  await getDb().delete(studyDeckStackItems).where(eq(studyDeckStackItems.stackId, stackId));
  await getDb()
    .insert(studyDeckStackItems)
    .values(deckIds.map((deckId, index) => ({ deckId, sortOrder: index, stackId })));

  return { deckCount: deckIds.length, id: stackId, title: plan.title };
}

async function upsertCard(args: {
  deckId: string;
  existingCardId?: string;
  file: string;
  fileRow: number;
  position: number;
  row: StudyRichImportNormalizedRow;
}) {
  const cardValues = {
    answer: args.row.answer,
    deckId: args.deckId,
    explanation: args.row.explanation ?? null,
    hint: args.row.hint ?? null,
    isVerified: false,
    level: args.row.level ?? null,
    position: args.position,
    question: args.row.question,
    updatedAt: new Date(),
    verifiedAt: null,
    verifiedBy: null,
  };

  const cardId = args.existingCardId
    ? (
        await getDb()
          .update(studyCards)
          .set(cardValues)
          .where(eq(studyCards.id, args.existingCardId))
          .returning({ id: studyCards.id })
      )[0].id
    : (
        await getDb()
          .insert(studyCards)
          .values(cardValues)
          .returning({ id: studyCards.id })
      )[0].id;

  await getDb().delete(studyCardSources).where(eq(studyCardSources.cardId, cardId));
  await getDb().delete(studyVerifications).where(eq(studyVerifications.cardId, cardId));

  await getDb().insert(studyCardSources).values({
    cardId,
    sourceLabel: args.row.source.sourceLabel ?? null,
    sourceMetadata: buildSourceMetadata(args.row, args.file, args.fileRow),
    sourceType: args.row.source.sourcePackId ? "source_pack_csv" : args.row.source.sourceUrl ? "url_csv" : "csv",
    sourceUrl: args.row.source.sourceUrl ?? null,
  });

  const hasVerification =
    Boolean(args.row.verification.status) ||
    typeof args.row.verification.confidence === "number" ||
    Boolean(args.row.verification.notes) ||
    args.row.verification.evidence.length > 0 ||
    Boolean(args.row.verification.verifier);
  if (hasVerification) {
    await getDb().insert(studyVerifications).values({
      cardId,
      confidence: args.row.verification.confidence ?? null,
      evidence: args.row.verification.evidence.length > 0 ? args.row.verification.evidence : null,
      note: buildVerificationNote(args.row),
      verificationStatus: args.row.verification.status ?? null,
      verifier: args.row.verification.verifier ?? null,
      verifiedByUserId: null,
    });
  }

  return cardId;
}

async function recalculateDeckCounts(deckIds: string[]) {
  for (const deckId of deckIds) {
    await getDb()
      .update(studyDecks)
      .set({
        cardCount: sql`(select count(*)::int from ${studyCards} where ${studyCards.deckId} = ${deckId})`,
        isOfficial: false,
        isPublic: false,
        updatedAt: new Date(),
        verifiedCardCount: 0,
      })
      .where(eq(studyDecks.id, deckId));
  }
}

async function verifyImport(args: {
  externalIds: string[];
  expectedDeckTitles: string[];
  privatePilotTitles: string[];
}) {
  const externalRows = await getExistingExternalCards(args.externalIds);
  const duplicates = groupDuplicateExternalIds(externalRows);
  const selectedDecks = await getDb()
    .select({
      cardCount: studyDecks.cardCount,
      id: studyDecks.id,
      isOfficial: studyDecks.isOfficial,
      isPublic: studyDecks.isPublic,
      title: studyDecks.title,
      verifiedCardCount: studyDecks.verifiedCardCount,
    })
    .from(studyDecks)
    .where(inArray(studyDecks.title, args.expectedDeckTitles))
    .orderBy(asc(studyDecks.title));
  const selectedDeckIds = selectedDecks.map((deck) => deck.id);
  const [cardCountRow] =
    selectedDeckIds.length > 0
      ? await getDb()
          .select({ cards: count(studyCards.id) })
          .from(studyCards)
          .where(inArray(studyCards.deckId, selectedDeckIds))
      : [{ cards: 0 }];
  const [verifiedCardsRow] =
    selectedDeckIds.length > 0
      ? await getDb()
          .select({ cards: count(studyCards.id) })
          .from(studyCards)
          .where(and(inArray(studyCards.deckId, selectedDeckIds), eq(studyCards.isVerified, true)))
      : [{ cards: 0 }];
  const [officialDecksRow] =
    selectedDeckIds.length > 0
      ? await getDb()
          .select({ decks: count(studyDecks.id) })
          .from(studyDecks)
          .where(and(inArray(studyDecks.id, selectedDeckIds), eq(studyDecks.isOfficial, true)))
      : [{ decks: 0 }];
  const [publicDecksRow] =
    selectedDeckIds.length > 0
      ? await getDb()
          .select({ decks: count(studyDecks.id) })
          .from(studyDecks)
          .where(and(inArray(studyDecks.id, selectedDeckIds), eq(studyDecks.isPublic, true)))
      : [{ decks: 0 }];
  const [nclexCardsRow] = await getDb()
    .select({ cards: count(studyCards.id) })
    .from(studyCards)
    .innerJoin(studyCardSources, eq(studyCardSources.cardId, studyCards.id))
    .where(sql`${studyCardSources.sourceMetadata}->>'importFile' ilike ${"%nclex-rn-pn-final-all-source-remediated-canonical%"}`);
  const [quarantineRows] = await getDb()
    .select({ cards: count(studyCards.id) })
    .from(studyCards)
    .innerJoin(studyCardSources, eq(studyCardSources.cardId, studyCards.id))
    .where(sql`${studyCardSources.sourceMetadata}->>'importFile' ilike ${"%quarantine%"}`);
  const [preservedSourcesRow] = await getDb()
    .select({ sources: count(studyCardSources.id) })
    .from(studyCardSources)
    .where(inArray(sql<string>`${studyCardSources.sourceMetadata}->>'externalId'`, args.externalIds));
  const [preservedVerificationRow] = await getDb()
    .select({ verifications: count(studyVerifications.id) })
    .from(studyVerifications)
    .innerJoin(studyCards, eq(studyCards.id, studyVerifications.cardId))
    .innerJoin(studyCardSources, eq(studyCardSources.cardId, studyCards.id))
    .where(inArray(sql<string>`${studyCardSources.sourceMetadata}->>'externalId'`, args.externalIds));

  const privatePilotDecks = selectedDecks.filter((deck) => args.privatePilotTitles.includes(deck.title));
  const privatePilotDeckIds = privatePilotDecks.map((deck) => deck.id);
  const [privatePilotCardRow] =
    privatePilotDeckIds.length > 0
      ? await getDb()
          .select({ cards: count(studyCards.id) })
          .from(studyCards)
          .where(inArray(studyCards.deckId, privatePilotDeckIds))
      : [{ cards: 0 }];

  assert(externalRows.length === args.externalIds.length, `Expected ${args.externalIds.length} externalId rows, got ${externalRows.length}`);
  assert(duplicates.length === 0, `Duplicate externalIds found after import: ${JSON.stringify(duplicates.slice(0, 5))}`);
  assert(cardCountRow.cards === expectedImportRows, `Expected ${expectedImportRows} imported cards, got ${cardCountRow.cards}`);
  assert(verifiedCardsRow.cards === 0, `Expected 0 app-side verified cards, got ${verifiedCardsRow.cards}`);
  assert(officialDecksRow.decks === 0, `Expected 0 official decks, got ${officialDecksRow.decks}`);
  assert(publicDecksRow.decks === 0, `Expected 0 public decks, got ${publicDecksRow.decks}`);
  assert(nclexCardsRow.cards === 0, `Expected 0 NCLEX imported cards, got ${nclexCardsRow.cards}`);
  assert(quarantineRows.cards === 0, `Expected 0 quarantine imported cards, got ${quarantineRows.cards}`);
  assert(privatePilotDecks.length === expectedPrivatePilotDecks, `Expected ${expectedPrivatePilotDecks} PPL decks, got ${privatePilotDecks.length}`);
  assert(privatePilotCardRow.cards === expectedPrivatePilotRows, `Expected ${expectedPrivatePilotRows} PPL cards, got ${privatePilotCardRow.cards}`);
  assert(preservedSourcesRow.sources === expectedImportRows, `Expected ${expectedImportRows} source rows, got ${preservedSourcesRow.sources}`);
  assert(preservedVerificationRow.verifications > 0, "Expected verification metadata rows to be preserved.");

  return {
    duplicateExternalIds: duplicates.length,
    importedCards: cardCountRow.cards,
    nclexImportedCards: nclexCardsRow.cards,
    officialDecks: officialDecksRow.decks,
    privatePilotCards: privatePilotCardRow.cards,
    privatePilotDecks: privatePilotDecks.length,
    publicDecks: publicDecksRow.decks,
    quarantineImportedCards: quarantineRows.cards,
    sourceRows: preservedSourcesRow.sources,
    verificationRows: preservedVerificationRow.verifications,
    verifiedCards: verifiedCardsRow.cards,
  };
}

function buildReportMarkdown(report: Record<string, unknown>) {
  return `# Study Local Ready Import Report - 2026-06-20

Status: ${dryRun ? "dry-run" : "imported locally"}

\`\`\`json
${JSON.stringify(report, null, 2)}
\`\`\`
`;
}

async function main() {
  assert(existsSync(studyReadyRoot), `Study ready root missing: ${studyReadyRoot}`);
  assert(!forbiddenPathPattern.test(studyReadyRoot), "Study ready root unexpectedly points to forbidden lane.");

  const csvFiles = walkFiles(studyReadyRoot).filter((file) => file.toLowerCase().endsWith(".csv"));
  const selectedFiles = csvFiles.filter(isStudyImportInput).sort((left, right) =>
    toRelativeStudyPath(left).localeCompare(toRelativeStudyPath(right)),
  );
  const skippedFiles = csvFiles
    .filter((file) => !selectedFiles.includes(file))
    .map((file) => ({ file: toRelativeStudyPath(file), reason: classifySkippedFile(file) }))
    .sort((left, right) => left.file.localeCompare(right.file));

  const { fileSummaries, rows } = parseImportRows(selectedFiles);
  assert(selectedFiles.length === 52, `Expected 52 import files, found ${selectedFiles.length}`);
  assert(rows.length === expectedImportRows, `Expected ${expectedImportRows} rows, found ${rows.length}`);

  const externalIds = rows.map((item) => item.row.externalId?.trim() ?? "");
  const duplicateImportExternalIds = [...externalIds.reduce((map, externalId) => {
    map.set(externalId, (map.get(externalId) ?? 0) + 1);
    return map;
  }, new Map<string, number>())]
    .filter(([, seen]) => seen > 1)
    .map(([externalId, seen]) => ({ externalId, seen }));
  assert(
    duplicateImportExternalIds.length === 0,
    `Import set contains duplicate externalIds: ${JSON.stringify(duplicateImportExternalIds.slice(0, 10))}`,
  );

  const deckPlans = buildDeckPlans(rows);
  const stackPlans = buildStackPlans(deckPlans);
  const expectedDeckTitles = deckPlans.map((plan) => plan.title);
  const privatePilotTitles = privatePilotDeckTitles(deckPlans);
  assert(
    privatePilotTitles.length === expectedPrivatePilotDecks,
    `Expected ${expectedPrivatePilotDecks} PPL deck titles, got ${privatePilotTitles.length}`,
  );
  const matchingPrivatePilotDecks = await getReplacementDecks(privatePilotTitles);
  const replacementDecks = matchingPrivatePilotDecks.filter(
    (deck) => deck.isOfficial || deck.isPublic || deck.verifiedCardCount > 0,
  );
  const replacementDeckIds = replacementDecks.map((deck) => deck.id);
  const replacementCardCount = replacementDecks.reduce((sum, deck) => sum + deck.actualCards, 0);
  assert(
    replacementDecks.length === 0 || replacementDecks.length === expectedPrivatePilotDecks,
    `PPL replacement safety check failed: expected 0 or ${expectedPrivatePilotDecks} matching local decks, got ${replacementDecks.length}`,
  );
  assert(
    replacementDecks.length === 0 || replacementCardCount === expectedPrivatePilotRows,
    `PPL replacement safety check failed: expected ${expectedPrivatePilotRows} cards, got ${replacementCardCount}`,
  );

  const existingCards = await getExistingExternalCards(externalIds, replacementDeckIds);
  const duplicateExistingExternalIds = groupDuplicateExternalIds(existingCards);
  assert(
    duplicateExistingExternalIds.length === 0,
    `Existing duplicate externalIds would make upsert unsafe: ${JSON.stringify(duplicateExistingExternalIds.slice(0, 5))}`,
  );

  const existingByExternalId = new Map(existingCards.map((card) => [card.externalId, card]));
  const expectedUpdates = rows.filter((row) => existingByExternalId.has(row.row.externalId ?? "")).length;
  const expectedInserts = rows.length - expectedUpdates;

  const report = {
    dryRun,
    expectedStacks: stackPlans.map((stack) => ({
      deckCount: stack.deckTitles.length,
      deckTitles: stack.deckTitles,
      title: stack.title,
    })),
    filesSelected: selectedFiles.map(toRelativeStudyPath),
    filesSkipped: skippedFiles,
    deckCount: deckPlans.length,
    expectedInserts,
    expectedRows: rows.length,
    expectedUpdates,
    fileSummaries,
    nclexStatus: "blocked_and_skipped_until_canonical_cards_plus_deck_memberships_are_supported",
    privatePilotReplacement: {
      decks: replacementDecks,
      expectedReplacementCards: replacementCardCount,
      expectedReplacementDecks: replacementDecks.length,
      matchingDecksByTitle: matchingPrivatePilotDecks,
      replacementEligibility: "only same-title PPL decks with old local public/official/verified markers are removed",
    },
  };

  if (dryRun) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  await getDb().transaction(async (tx) => {
    if (replacementDeckIds.length > 0) {
      await tx.delete(studyDecks).where(inArray(studyDecks.id, replacementDeckIds));
    }
  });

  const existingCardsAfterReplacement = await getExistingExternalCards(externalIds);
  const duplicateExistingAfterReplacement = groupDuplicateExternalIds(existingCardsAfterReplacement);
  assert(
    duplicateExistingAfterReplacement.length === 0,
    `Existing duplicate externalIds after PPL replacement: ${JSON.stringify(duplicateExistingAfterReplacement.slice(0, 5))}`,
  );
  const cardByExternalId = new Map(existingCardsAfterReplacement.map((card) => [card.externalId, card]));
  const deckIdsByTitle = new Map<string, string>();
  const touchedDeckIds = new Set<string>();
  const touchedStacks: Array<{ deckCount: number; id: string; title: string }> = [];
  let insertedCards = 0;
  let updatedCards = 0;

  for (const plan of deckPlans) {
    const deckId = await upsertDeck(plan);
    deckIdsByTitle.set(plan.title, deckId);
    touchedDeckIds.add(deckId);
    for (const [index, importRow] of plan.rows.entries()) {
      const existing = cardByExternalId.get(importRow.row.externalId ?? "");
      const cardId = await upsertCard({
        deckId,
        existingCardId: existing?.cardId,
        file: importRow.file,
        fileRow: importRow.fileRow,
        position: index,
        row: importRow.row,
      });
      if (existing) {
        updatedCards += 1;
      } else {
        insertedCards += 1;
      }
      cardByExternalId.set(importRow.row.externalId ?? "", {
        cardId,
        deckId,
        deckTitle: plan.title,
        externalId: importRow.row.externalId ?? "",
      });
    }
  }

  for (const plan of stackPlans) {
    touchedStacks.push(await upsertStack(plan, deckIdsByTitle));
  }

  await recalculateDeckCounts([...touchedDeckIds]);
  const verification = await verifyImport({
    expectedDeckTitles,
    externalIds,
    privatePilotTitles,
  });
  const finalReport = {
    ...report,
    dryRun: false,
    imported: {
      insertedCards,
      touchedStacks,
      updatedCards,
      touchedDecks: touchedDeckIds.size,
    },
    verification,
  };
  console.log(JSON.stringify(finalReport, null, 2));

  if (writeReport) {
    mkdirSync(reportsRoot, { recursive: true });
    writeFileSync(
      path.join(reportsRoot, "STUDY_LOCAL_READY_IMPORT_REPORT_2026-06-20.md"),
      buildReportMarkdown(finalReport),
      "utf8",
    );
    writeFileSync(
      path.join(reportsRoot, "STUDY_LOCAL_READY_IMPORT_REPORT_2026-06-20.json"),
      `${JSON.stringify(finalReport, null, 2)}\n`,
      "utf8",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
