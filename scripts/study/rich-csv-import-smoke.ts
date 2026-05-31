import { eq } from "drizzle-orm";
import { Pool } from "pg";

import { getDb } from "@/server/db/client";
import { studyCardSources, studyCards, studyDecks, studyVerifications, users } from "@/server/db/schema";
import {
  parseStudyRichFlashcardImportText,
  saveStudyRichFlashcardImport,
} from "@/server/study/study-rich-flashcard-import";

const sampleCsv = `card_id,question,answer,hint,tags,source_pack_id,source_chunk_ids,source_page_anchors,source_visual_ids,verification_status,verification_confidence,verification_notes,verification_evidence,verifier
sample-001,What is trim?,Relieves control pressure in steady flight.,Set pitch first then trim.,fundamentals|controls,phak-25c,chunk-001|chunk-002,page=12;page=13,figure-12-a,verified,0.91,Checked against source chunks,chunk-001|chunk-002,admin_review`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertMigration0054Columns(connectionString: string) {
  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query<{ column_name: string; table_name: string }>(
      `
        select table_name, column_name
        from information_schema.columns
        where table_schema = 'public'
          and (
            (table_name = 'study_card_sources' and column_name = 'source_metadata')
            or (table_name = 'study_verifications' and column_name in ('verification_status', 'evidence', 'verifier'))
          )
      `,
    );
    const columns = new Set(result.rows.map((row) => `${row.table_name}.${row.column_name}`));
    for (const requiredColumn of [
      "study_card_sources.source_metadata",
      "study_verifications.verification_status",
      "study_verifications.evidence",
      "study_verifications.verifier",
    ]) {
      assert(columns.has(requiredColumn), `Missing ${requiredColumn}. Apply migrations through 0054 first.`);
    }
  } finally {
    await pool.end();
  }
}

async function runParseOnly() {
  const parsed = parseStudyRichFlashcardImportText(sampleCsv);

  assert(parsed.errors.length === 0, `Expected no parse errors, got ${JSON.stringify(parsed.errors)}`);
  assert(parsed.rowCount === 1, `Expected one row, got ${parsed.rowCount}`);
  assert(parsed.sourceCoverage.sourcePackIds.includes("phak-25c"), "Expected source pack id coverage.");
  assert(parsed.sourceCoverage.uniqueChunkIds === 2, "Expected two unique source chunks.");
  assert(parsed.sourceCoverage.uniquePages === 2, "Expected two unique source pages.");
  assert(parsed.sourceCoverage.uniqueVisualAssetIds === 1, "Expected one visual asset id.");
  assert(parsed.verificationStatusCounts.verified === 1, "Expected one verified row.");

  console.log("rich CSV parser smoke passed");
}

async function runDbSmoke() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for DB smoke mode. Use --parse-only without a database.");
  }

  await assertMigration0054Columns(process.env.DATABASE_URL);

  const adminUserId = "study-rich-csv-smoke-admin";
  const deckTitle = `[TEST_DELETE] Rich CSV Import Smoke ${new Date().toISOString()}`;
  const parsed = parseStudyRichFlashcardImportText(sampleCsv);

  assert(parsed.errors.length === 0, `Expected no parse errors, got ${JSON.stringify(parsed.errors)}`);

  const db = getDb();
  await db
    .insert(users)
    .values({
      email: "study-rich-csv-smoke@example.com",
      id: adminUserId,
      name: "Study Rich CSV Smoke",
    })
    .onConflictDoNothing();

  const [deck] = await db
    .insert(studyDecks)
    .values({
      description: "Disposable rich CSV import smoke deck.",
      title: deckTitle,
      userId: adminUserId,
    })
    .returning({ id: studyDecks.id });

  const saveResult = await saveStudyRichFlashcardImport({
    adminUserId,
    deckId: deck.id,
    rows: parsed.rows,
  });

  assert(saveResult.createdCardCount === 1, "Expected one created card.");
  assert(saveResult.createdSourceCount === 1, "Expected one source row.");
  assert(saveResult.createdVerificationCount === 1, "Expected one verification row.");
  assert(saveResult.verifiedCardCount === 1, "Expected one verified card.");

  const [card] = await db.select().from(studyCards).where(eq(studyCards.deckId, deck.id)).limit(1);

  assert(card, "Expected imported card to be readable.");

  const [source] = await db.select().from(studyCardSources).where(eq(studyCardSources.cardId, card.id));
  const [verification] = await db
    .select()
    .from(studyVerifications)
    .where(eq(studyVerifications.cardId, card.id));

  assert(source?.sourceMetadata, "Expected source metadata to be saved.");
  assert(verification?.verificationStatus === "verified", "Expected verification status to be saved.");
  assert(verification?.evidence?.includes("chunk-001"), "Expected verification evidence to be saved.");

  if (process.argv.includes("--cleanup")) {
    await db.delete(studyDecks).where(eq(studyDecks.id, deck.id));
    console.log("rich CSV DB smoke passed; disposable deck cleaned up");
    return;
  }

  console.log(`rich CSV DB smoke passed; deckId=${deck.id}; cleanup title prefix=[TEST_DELETE]`);
}

async function main() {
  const parseOnly = process.argv.includes("--parse-only");

  if (parseOnly) {
    await runParseOnly();
    return;
  }

  await runDbSmoke();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
