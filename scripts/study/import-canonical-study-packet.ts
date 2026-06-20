import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  studyCanonicalCards,
  studyCardSources,
  studyCards,
  studyDeckCardMemberships,
  studyDeckImports,
  studyDeckStackItems,
  studyDeckStacks,
  studyDecks,
  studyVerifications,
} from "@/server/db/schema";

const defaultPacketDir =
  "E:\\Codex\\QuesIQ\\QuesIQ Content Management\\QuesIQ Content Library\\artifacts\\imports\\_status\\01-ready-to-import\\study\\healthcare\\apmt-teas-hesi-canonicalized-study-import-2026-06-20";

const packetDir = process.env.STUDY_CANONICAL_PACKET_DIR || defaultPacketDir;
const dryRun = process.argv.includes("--dry-run");
const writeReport = process.argv.includes("--write-report");

const canonicalCardsFile = path.join(
  packetDir,
  "healthcare-apmt-teas-hesi-canonical-cards-candidate-2026-06-20.csv",
);
const membershipsFile = path.join(
  packetDir,
  "healthcare-apmt-teas-hesi-deck-memberships-candidate-2026-06-20.csv",
);

type CsvRow = Record<string, string>;

type CanonicalCardRow = CsvRow & {
  answer: string;
  cardId: string;
  canonicalStatus: string;
  explanation: string;
  hint: string;
  isOfficial: string;
  isVerified: string;
  question: string;
  sourceLabel: string;
  sourceUrl: string;
  verificationEvidence: string;
  verificationNotes: string;
  verificationStatus: string;
};

type MembershipRow = CsvRow & {
  canonicalCardId: string;
  cardId: string;
  certification: string;
  deckAnswerOverride: string;
  deckCardId: string;
  deckExplanationOverride: string;
  deckHintOverride: string;
  deckId: string;
  deckLevelOverride: string;
  deckQuestionOverride: string;
  deckSourceNoteOverride: string;
  deckTags: string;
  deckTitle: string;
  originalExternalId: string;
  originalFile: string;
  reusePolicy: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }

  return rows;
}

function readCsv(file: string) {
  const matrix = parseCsv(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  assert(matrix.length > 0, `${file} is empty`);
  const [headers, ...dataRows] = matrix;
  return dataRows.map((values, index) => {
    assert(
      values.length === headers.length,
      `${path.basename(file)} row ${index + 2} has ${values.length} fields, expected ${headers.length}`,
    );
    return Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
  });
}

function splitList(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value: string) {
  return /^(true|1|yes)$/i.test(value.trim());
}

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseEvidence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed.map((item) => JSON.stringify(item)) : [trimmed];
  } catch {
    return [trimmed];
  }
}

function fieldOverride(value: string) {
  return value.trim() ? value.trim() : null;
}

function applyOverride(base: string, override: string) {
  return fieldOverride(override) ?? base;
}

function buildSourceMetadata(card: CanonicalCardRow, membership: MembershipRow) {
  return {
    canonicalCardId: card.cardId,
    canonicalStatus: card.canonicalStatus,
    deckCardId: membership.deckCardId,
    originalExternalId: membership.originalExternalId,
    originalFile: membership.originalFile,
    packetDir,
    reusePolicy: membership.reusePolicy,
    sourcePackId: card.sourcePackId || null,
    sourcePackTitle: card.sourcePackTitle || null,
    sourcePages: card.sourcePages || null,
    supersedesExternalIds: card.supersedesExternalIds || null,
  };
}

function buildVerificationMetadata(card: CanonicalCardRow) {
  return {
    confidence: parseNumber(card.verificationConfidence),
    evidence: parseEvidence(card.verificationEvidence),
    notes: card.verificationNotes || null,
    status: card.verificationStatus || null,
    verifier: card.verifier || null,
  };
}

function buildContentMetadata(card: CanonicalCardRow) {
  return {
    additionalReferenceLabels: splitList(card.additionalReferenceLabels),
    additionalReferenceUrls: splitList(card.additionalReferenceUrls),
    draftConfidence: parseNumber(card.draftConfidence),
    draftId: card.draftId || null,
    draftWarnings: splitList(card.draftWarnings),
    examOrStandard: card.examOrStandard || null,
    industry: card.industry || null,
    referenceNote: card.referenceNote || null,
    role: card.role || null,
    selectedAnswerPolicy: card.selectedAnswerPolicy || null,
    sourceSelection: card.sourceSelection || null,
    subject: card.subject || null,
    topic: card.topic || null,
    version: card.version || null,
  };
}

function validatePacket(cards: CanonicalCardRow[], memberships: MembershipRow[]) {
  const cardIds = new Set(cards.map((card) => card.cardId));
  const deckCardIds = new Set<string>();
  const deckCanonicalPairs = new Set<string>();
  const issues: string[] = [];

  for (const card of cards) {
    if (!card.cardId) issues.push("canonical card missing cardId");
    if (!card.question) issues.push(`${card.cardId} missing question`);
    if (!card.answer) issues.push(`${card.cardId} missing answer`);
    if (card.verificationStatus !== "verified") {
      issues.push(`${card.cardId} is not verificationStatus=verified`);
    }
    if (!card.sourceUrl) issues.push(`${card.cardId} missing sourceUrl`);
    if (!parseBoolean(card.isOfficial)) issues.push(`${card.cardId} is not isOfficial=true`);
    if (!parseBoolean(card.isVerified)) issues.push(`${card.cardId} is not isVerified=true`);
    if (
      card.expertReviewer ||
      card.expertReviewDate ||
      card.expertReviewStatus === "expert_reviewed"
    ) {
      issues.push(`${card.cardId} claims expert review`);
    }
  }

  for (const membership of memberships) {
    if (!cardIds.has(membership.canonicalCardId)) {
      issues.push(`${membership.deckCardId} references missing canonical card ${membership.canonicalCardId}`);
    }
    if (deckCardIds.has(membership.deckCardId)) {
      issues.push(`duplicate deckCardId ${membership.deckCardId}`);
    }
    deckCardIds.add(membership.deckCardId);
    const pair = `${membership.deckId}:${membership.canonicalCardId}`;
    if (deckCanonicalPairs.has(pair)) {
      issues.push(`duplicate deck/canonical pair ${pair}`);
    }
    deckCanonicalPairs.add(pair);
  }

  return issues;
}

async function upsertDeck(title: string, rows: MembershipRow[]) {
  const first = rows[0];
  const [existing] = await getDb()
    .select({ id: studyDecks.id })
    .from(studyDecks)
    .where(eq(studyDecks.title, title))
    .limit(1);
  const values = {
    cardCount: rows.length,
    description: `Official QuesIQ Study deck imported from canonical healthcare packet ${path.basename(packetDir)}.`,
    isOfficial: true,
    isPublic: true,
    subject: first.certification || first.deckTitle,
    tags: splitList(rows.flatMap((row) => splitList(row.deckTags)).join(" | ")),
    title,
    updatedAt: new Date(),
    userId: null,
    verifiedCardCount: rows.length,
  };

  if (existing) {
    const [deck] = await getDb()
      .update(studyDecks)
      .set(values)
      .where(eq(studyDecks.id, existing.id))
      .returning({ id: studyDecks.id });
    return deck.id;
  }

  const [deck] = await getDb().insert(studyDecks).values(values).returning({ id: studyDecks.id });
  return deck.id;
}

async function upsertCanonicalCard(row: CanonicalCardRow) {
  const values = {
    answer: row.answer,
    canonicalStatus: row.canonicalStatus,
    contentMetadata: buildContentMetadata(row),
    explanation: row.explanation || null,
    externalCardId: row.cardId,
    hint: row.hint || null,
    isOfficial: parseBoolean(row.isOfficial),
    isVerified: parseBoolean(row.isVerified),
    level: row.level || null,
    question: row.question,
    sourceLabel: row.sourceLabel || null,
    sourceMetadata: {
      sourceChunkIds: splitList(row.sourceChunkIds),
      sourceNotes: row.sourceNotes || null,
      sourcePackId: row.sourcePackId || null,
      sourcePackTitle: row.sourcePackTitle || null,
      sourcePages: row.sourcePages || null,
      sourceVisualAssetIds: splitList(row.sourceVisualAssetIds),
    },
    sourceUrl: row.sourceUrl || null,
    tags: splitList(row.tags),
    updatedAt: new Date(),
    verificationMetadata: buildVerificationMetadata(row),
  };

  const [existing] = await getDb()
    .select({ id: studyCanonicalCards.id })
    .from(studyCanonicalCards)
    .where(eq(studyCanonicalCards.externalCardId, row.cardId))
    .limit(1);

  if (existing) {
    const [card] = await getDb()
      .update(studyCanonicalCards)
      .set(values)
      .where(eq(studyCanonicalCards.id, existing.id))
      .returning({ id: studyCanonicalCards.id });
    return card.id;
  }

  const [card] = await getDb()
    .insert(studyCanonicalCards)
    .values(values)
    .returning({ id: studyCanonicalCards.id });
  return card.id;
}

async function upsertDeckCard(args: {
  canonicalDbId: string;
  card: CanonicalCardRow;
  deckId: string;
  membership: MembershipRow;
}) {
  const { card, membership } = args;
  const question = applyOverride(card.question, membership.deckQuestionOverride);
  const answer = applyOverride(card.answer, membership.deckAnswerOverride);
  const explanation = applyOverride(card.explanation, membership.deckExplanationOverride);
  const hint = applyOverride(card.hint, membership.deckHintOverride);
  const level = applyOverride(card.level, membership.deckLevelOverride);

  const [existingMembership] = await getDb()
    .select({ cardId: studyDeckCardMemberships.cardId })
    .from(studyDeckCardMemberships)
    .where(eq(studyDeckCardMemberships.deckCardId, membership.deckCardId))
    .limit(1);

  const cardValues = {
    answer,
    canonicalCardId: args.canonicalDbId,
    deckId: args.deckId,
    explanation: explanation || null,
    hint: hint || null,
    isVerified: true,
    level: level || null,
    position: Number(membership.deckOrder) || 0,
    question,
    updatedAt: new Date(),
    verifiedAt: new Date(),
    verifiedBy: "quesiq-s12-promotion",
  };

  const deckCardId = existingMembership
    ? (
        await getDb()
          .update(studyCards)
          .set(cardValues)
          .where(eq(studyCards.id, existingMembership.cardId))
          .returning({ id: studyCards.id })
      )[0].id
    : (
        await getDb().insert(studyCards).values(cardValues).returning({ id: studyCards.id })
      )[0].id;

  await getDb().delete(studyCardSources).where(eq(studyCardSources.cardId, deckCardId));
  await getDb().delete(studyVerifications).where(eq(studyVerifications.cardId, deckCardId));

  await getDb().insert(studyCardSources).values({
    cardId: deckCardId,
    sourceLabel: card.sourceLabel || null,
    sourceMetadata: buildSourceMetadata(card, membership),
    sourceType: "canonical_study_packet",
    sourceUrl: card.sourceUrl || null,
  });

  await getDb().insert(studyVerifications).values({
    cardId: deckCardId,
    confidence: parseNumber(card.verificationConfidence),
    evidence: parseEvidence(card.verificationEvidence),
    note: card.verificationNotes || null,
    verificationStatus: card.verificationStatus || null,
    verifier: card.verifier || null,
    verifiedByUserId: null,
  });

  const membershipValues = {
    audience: membership.audience || null,
    canonicalCardId: args.canonicalDbId,
    cardId: deckCardId,
    certification: membership.certification || null,
    deckId: args.deckId,
    deckOrder: Number(membership.deckOrder) || 0,
    deckTags: splitList(membership.deckTags),
    originalExternalId: membership.originalExternalId,
    originalFile: membership.originalFile || null,
    overrides: {
      answer: fieldOverride(membership.deckAnswerOverride),
      explanation: fieldOverride(membership.deckExplanationOverride),
      hint: fieldOverride(membership.deckHintOverride),
      level: fieldOverride(membership.deckLevelOverride),
      question: fieldOverride(membership.deckQuestionOverride),
      sourceNote: fieldOverride(membership.deckSourceNoteOverride),
    },
    reusePolicy: membership.reusePolicy,
    updatedAt: new Date(),
  };

  if (existingMembership) {
    await getDb()
      .update(studyDeckCardMemberships)
      .set(membershipValues)
      .where(eq(studyDeckCardMemberships.deckCardId, membership.deckCardId));
  } else {
    await getDb()
      .insert(studyDeckCardMemberships)
      .values({ ...membershipValues, deckCardId: membership.deckCardId });
  }

  return deckCardId;
}

async function upsertHealthcareStack(deckIdsByTitle: Map<string, string>) {
  const title = "Healthcare A&P, TEAS 7, and HESI A2 Official Study Stack";
  const deckIds = [...deckIdsByTitle.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, deckId]) => deckId);

  const values = {
    description: "Official QuesIQ Study stack imported from the canonical A&P, TEAS 7, and HESI A2 packet.",
    isOfficial: true,
    isPublic: true,
    subject: "Healthcare",
    title,
    updatedAt: new Date(),
    userId: null,
  };

  const [existing] = await getDb()
    .select({ id: studyDeckStacks.id })
    .from(studyDeckStacks)
    .where(eq(studyDeckStacks.title, title))
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
        await getDb().insert(studyDeckStacks).values(values).returning({ id: studyDeckStacks.id })
      )[0].id;

  await getDb().delete(studyDeckStackItems).where(eq(studyDeckStackItems.stackId, stackId));
  await getDb()
    .insert(studyDeckStackItems)
    .values(deckIds.map((deckId, index) => ({ deckId, sortOrder: index, stackId })));

  return { deckCount: deckIds.length, id: stackId, title };
}

async function verifyDatabaseImport(deckTitles: string[]) {
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
    .where(inArray(studyDecks.title, deckTitles));
  const deckIds = decks.map((deck) => deck.id);
  const [canonicalCount] = await getDb().select({ count: sql<number>`count(*)::int` }).from(studyCanonicalCards);
  const [membershipCount] =
    deckIds.length > 0
      ? await getDb()
          .select({ count: sql<number>`count(*)::int` })
          .from(studyDeckCardMemberships)
          .where(inArray(studyDeckCardMemberships.deckId, deckIds))
      : [{ count: 0 }];
  const [verifiedCards] =
    deckIds.length > 0
      ? await getDb()
          .select({ count: sql<number>`count(*)::int` })
          .from(studyCards)
          .where(andInDecksVerified(deckIds))
      : [{ count: 0 }];

  return {
    canonicalCardsInDatabase: canonicalCount.count,
    importedDecks: decks.length,
    officialDecks: decks.filter((deck) => deck.isOfficial).length,
    publicDecks: decks.filter((deck) => deck.isPublic).length,
    studyDeckMemberships: membershipCount.count,
    verifiedDeckCards: verifiedCards.count,
  };
}

function andInDecksVerified(deckIds: string[]) {
  return sql`${studyCards.deckId} = any(${deckIds}) and ${studyCards.isVerified} = true`;
}

async function main() {
  const cards = readCsv(canonicalCardsFile) as CanonicalCardRow[];
  const memberships = readCsv(membershipsFile) as MembershipRow[];
  const issues = validatePacket(cards, memberships);
  assert(issues.length === 0, `Canonical packet validation failed: ${JSON.stringify(issues.slice(0, 20))}`);

  const cardsByExternalId = new Map(cards.map((card) => [card.cardId, card]));
  const membershipsByDeck = new Map<string, MembershipRow[]>();
  for (const membership of memberships) {
    const rows = membershipsByDeck.get(membership.deckTitle) ?? [];
    rows.push(membership);
    membershipsByDeck.set(membership.deckTitle, rows);
  }

  const report: Record<string, unknown> = {
    cards: cards.length,
    dryRun,
    memberships: memberships.length,
    packetDir,
    validationIssues: issues.length,
    uniqueDecks: membershipsByDeck.size,
  };

  if (dryRun) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const canonicalDbIds = new Map<string, string>();
  for (const card of cards) {
    canonicalDbIds.set(card.cardId, await upsertCanonicalCard(card));
  }

  const deckIdsByTitle = new Map<string, string>();
  for (const [deckTitle, deckRows] of membershipsByDeck) {
    deckIdsByTitle.set(deckTitle, await upsertDeck(deckTitle, deckRows));
  }

  for (const membership of memberships) {
    const card = cardsByExternalId.get(membership.canonicalCardId);
    const canonicalDbId = canonicalDbIds.get(membership.canonicalCardId);
    const deckId = deckIdsByTitle.get(membership.deckTitle);
    assert(card, `Missing canonical card ${membership.canonicalCardId}`);
    assert(canonicalDbId, `Missing canonical DB id for ${membership.canonicalCardId}`);
    assert(deckId, `Missing deck id for ${membership.deckTitle}`);
    await upsertDeckCard({ canonicalDbId, card, deckId, membership });
  }

  const deckIds = [...deckIdsByTitle.values()];
  for (const [deckTitle, deckId] of deckIdsByTitle) {
    const [counts] = await getDb()
      .select({
        cards: sql<number>`count(*)::int`,
        verified: sql<number>`count(case when ${studyCards.isVerified} = true then 1 end)::int`,
      })
      .from(studyCards)
      .where(eq(studyCards.deckId, deckId));
    await getDb()
      .update(studyDecks)
      .set({
        cardCount: counts.cards,
        isOfficial: true,
        isPublic: true,
        updatedAt: new Date(),
        verifiedCardCount: counts.verified,
      })
      .where(eq(studyDecks.id, deckId));
    assert(counts.cards > 0, `${deckTitle} has no cards after import`);
  }

  const stack = await upsertHealthcareStack(deckIdsByTitle);
  await getDb().insert(studyDeckImports).values({
    deckId: deckIds[0],
    failedUrls: [],
    importType: "canonical_study_packet",
    sourceCount: cards.length,
    sourceSummary: `Imported ${cards.length} canonical cards and ${memberships.length} memberships from ${path.basename(packetDir)}. Stack: ${stack.title}.`,
    userId: null,
  });

  const verification = await verifyDatabaseImport([...deckIdsByTitle.keys()]);
  const finalReport = { ...report, stack, ...verification };
  if (writeReport) {
    writeFileSync(
      path.join(packetDir, "app-canonical-import-report-2026-06-20.json"),
      JSON.stringify(finalReport, null, 2),
    );
  }
  console.log(JSON.stringify(finalReport, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
