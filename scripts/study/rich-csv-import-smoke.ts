import { eq } from "drizzle-orm";
import { Pool } from "pg";

import { getDb } from "@/server/db/client";
import { studyCardSources, studyCards, studyDecks, studyVerifications, users } from "@/server/db/schema";
import {
  parseStudyRichFlashcardImportText,
  saveStudyRichFlashcardImport,
  STUDY_RICH_IMPORT_DEFAULT_COLUMN_MAPPING,
} from "@/server/study/study-rich-flashcard-import";

const sampleCsv = `card_id,question,answer,explanation,hint,tags,source_pack_id,source_chunk_ids,source_page_anchors,source_visual_ids,verification_status,verification_confidence,verification_notes,verification_evidence,verifier
sample-001,What is trim?,Relieves control pressure in steady flight.,Trim reduces the continuous force needed to hold the selected attitude.,Set pitch first then trim.,fundamentals|controls,phak-25c,chunk-001|chunk-002,page=12;page=13,figure-12-a,verified,0.91,Checked against source chunks,chunk-001|chunk-002,admin_review`;

const mappedCsv = `Prompt,Response,Explanation,Memo,Difficulty,CategoryTags,PackIdentifier,ChunkRefs,PageRefs,VisualRefs,ReviewState,ReviewConfidence,ReviewNotes,EvidenceRows,Reviewer,DraftRef,ExternalRef
"When do you re-trim?","After any sustained pitch or power change.","Use trim after changing pitch or power because the required control force changes.","Trim removes control pressure.","beginner","fundamentals|trim","phak-25c","chunk-010|chunk-011","14|15","figure-14-a","needs_review","0.73","Needs follow-up","chunk-010|chunk-011","admin_qc","draft-abc","row-abc"`;

const officialSchemaHeader =
  "industry,role,certification,examOrStandard,version,subject,topic,question,shortAnswer,explanation,officialReference,officialReferenceUrl,additionalReferenceLabels,additionalReferenceUrls,referenceNote,tags";
const officialSchemaRow =
  "Aviation,Pilot,Private Pilot,Private Pilot ACS,\"FAA-S-ACS-6C, April 2024\",Certification Requirements,Eligibility,What are the basic eligibility requirements for a private pilot certificate?,\"Be 17, read/speak/write English, meet training, knowledge, experience, and practical test requirements.\",\"14 CFR 61.103 sets the basic eligibility gate for a private pilot certificate.\",14 CFR 61.103,https://www.ecfr.gov/current/title-14/chapter-I/subchapter-D/part-61/subpart-E/section-61.103,Private Pilot ACS Task I.A,https://www.ecfr.gov/current/title-14/chapter-I/subchapter-D/part-61/subpart-E/section-61.105,Primary regulation supports the eligibility fact.,acs|private-pilot";
const officialSchemaCsv = `${officialSchemaHeader}
${officialSchemaRow}`;

const explicitOfficialVerifiedCsv = `${officialSchemaHeader},official,verified
${officialSchemaRow},true,true`;

const mappedColumnMapping = {
  ...STUDY_RICH_IMPORT_DEFAULT_COLUMN_MAPPING,
  answer: "Response",
  draftId: "DraftRef",
  externalId: "ExternalRef",
  explanation: "Explanation",
  hint: "Memo",
  level: "Difficulty",
  question: "Prompt",
  sourceChunkIds: "ChunkRefs",
  sourcePackId: "PackIdentifier",
  sourcePages: "PageRefs",
  sourceVisualAssetIds: "VisualRefs",
  tags: "CategoryTags",
  verificationConfidence: "ReviewConfidence",
  verificationEvidence: "EvidenceRows",
  verificationNotes: "ReviewNotes",
  verificationStatus: "ReviewState",
  verifier: "Reviewer",
} as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertRichImportColumns(connectionString: string) {
  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query<{ column_name: string; table_name: string }>(
      `
        select table_name, column_name
        from information_schema.columns
        where table_schema = 'public'
          and (
            (table_name = 'study_cards' and column_name = 'explanation')
            or
            (table_name = 'study_card_sources' and column_name = 'source_metadata')
            or (table_name = 'study_verifications' and column_name in ('verification_status', 'evidence', 'verifier'))
          )
      `,
    );
    const columns = new Set(result.rows.map((row) => `${row.table_name}.${row.column_name}`));
    for (const requiredColumn of [
      "study_cards.explanation",
      "study_card_sources.source_metadata",
      "study_verifications.verification_status",
      "study_verifications.evidence",
      "study_verifications.verifier",
    ]) {
      assert(columns.has(requiredColumn), `Missing ${requiredColumn}. Apply migrations through 0080 first.`);
    }
  } finally {
    await pool.end();
  }
}

async function runParseOnly() {
  const parsed = parseStudyRichFlashcardImportText(sampleCsv);

  assert(parsed.errors.length === 0, `Expected no parse errors, got ${JSON.stringify(parsed.errors)}`);
  assert(parsed.rowCount === 1, `Expected one row, got ${parsed.rowCount}`);
  assert(parsed.rows[0].explanation.startsWith("Trim reduces"), "Expected explanation to parse separately.");
  assert(parsed.rows[0].hint === "Set pitch first then trim.", "Expected hint to stay separate from explanation.");
  assert(parsed.sourceCoverage.sourcePackIds.includes("phak-25c"), "Expected source pack id coverage.");
  assert(parsed.sourceCoverage.uniqueChunkIds === 2, "Expected two unique source chunks.");
  assert(parsed.sourceCoverage.uniquePages === 2, "Expected two unique source pages.");
  assert(parsed.sourceCoverage.uniqueVisualAssetIds === 1, "Expected one visual asset id.");
  assert(parsed.verificationStatusCounts.verified === 1, "Expected one verified row.");
  assert(parsed.unmappedRequiredFields.length === 0, "Expected no unmapped required fields with default headers.");

  const mappedParsed = parseStudyRichFlashcardImportText(mappedCsv, {
    columnMapping: mappedColumnMapping,
  });
  assert(mappedParsed.errors.length === 0, `Expected no mapped parse errors, got ${JSON.stringify(mappedParsed.errors)}`);
  assert(mappedParsed.rowCount === 1, `Expected one mapped row, got ${mappedParsed.rowCount}`);
  assert(mappedParsed.rows[0].question === "When do you re-trim?", "Expected mapped question value.");
  assert(mappedParsed.rows[0].answer.startsWith("After any sustained"), "Expected mapped answer value.");
  assert(mappedParsed.rows[0].explanation.startsWith("Use trim"), "Expected mapped explanation value.");
  assert(mappedParsed.rows[0].hint === "Trim removes control pressure.", "Expected mapped hint value.");
  assert(mappedParsed.rows[0].source.sourcePackId === "phak-25c", "Expected mapped source pack id.");
  assert(mappedParsed.verificationStatusCounts.needs_review === 1, "Expected mapped needs_review count.");
  assert(mappedParsed.unmappedRequiredFields.length === 0, "Expected mapped required fields to resolve.");

  const officialSchemaParsed = parseStudyRichFlashcardImportText(officialSchemaCsv);
  assert(officialSchemaParsed.errors.length === 0, `Expected no official-schema parse errors, got ${JSON.stringify(officialSchemaParsed.errors)}`);
  assert(officialSchemaParsed.rowCount === 1, `Expected one official-schema row, got ${officialSchemaParsed.rowCount}`);
  assert(officialSchemaParsed.rows[0].answer.startsWith("Be 17"), "Expected shortAnswer to map into answer.");
  assert(
    officialSchemaParsed.rows[0].explanation.startsWith("14 CFR 61.103"),
    "Expected explanation to map into its own learner-facing field.",
  );
  assert(officialSchemaParsed.rows[0].hint === undefined, "Expected explanation not to map into hint.");
  assert(officialSchemaParsed.rows[0].topic === "Eligibility", "Expected topic to map.");
  assert(
    officialSchemaParsed.rows[0].source.additionalReferenceLabels[0] === "Private Pilot ACS Task I.A",
    "Expected additional reference label to map.",
  );
  assert(
    officialSchemaParsed.rows[0].source.referenceNote === "Primary regulation supports the eligibility fact.",
    "Expected reference note to map.",
  );
  assert(officialSchemaParsed.rows[0].isOfficial === true, "Expected officialReference schema to infer official row.");
  assert(officialSchemaParsed.rows[0].verification.status === undefined, "Expected verified status to remain unset without explicit field.");
  assert(
    officialSchemaParsed.rows[0].source.sourceUrl?.includes("ecfr.gov"),
    "Expected officialReferenceUrl to map into sourceUrl.",
  );

  const explicitOfficialVerifiedParsed = parseStudyRichFlashcardImportText(explicitOfficialVerifiedCsv);
  assert(
    explicitOfficialVerifiedParsed.rows[0].verification.status === "verified",
    "Expected explicit verified boolean to map into verification status.",
  );

  console.log("rich CSV parser smoke passed (default + mapped + official-schema headers)");
}

async function runDbSmoke() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for DB smoke mode. Use --parse-only without a database.");
  }

  await assertRichImportColumns(process.env.DATABASE_URL);

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
  assert(card.explanation?.startsWith("Trim reduces"), "Expected imported explanation to be saved on the card.");

  const [source] = await db.select().from(studyCardSources).where(eq(studyCardSources.cardId, card.id));
  const [verification] = await db
    .select()
    .from(studyVerifications)
    .where(eq(studyVerifications.cardId, card.id));

  assert(source?.sourceMetadata, "Expected source metadata to be saved.");
  assert(
    Array.isArray(source.sourceMetadata.sourcePages) && source.sourceMetadata.sourcePages.length === 2,
    "Expected source pages to be saved in metadata.",
  );
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
