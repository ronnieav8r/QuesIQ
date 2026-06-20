export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";

type Props = {
  searchParams: Promise<{
    deck?: string;
    q?: string;
  }>;
};

type ImportedDeckRow = {
  cardCount: number;
  deckId: string;
  importedCards: number;
  isOfficial: boolean;
  isPublic: boolean;
  sourceRows: number;
  subject: string | null;
  title: string;
  verifiedCards: number;
  verificationRows: number;
};

type ImportedStackRow = {
  cardCount: number;
  deckCount: number;
  isOfficial: boolean;
  isPublic: boolean;
  stackId: string;
  subject: string | null;
  title: string;
  verifiedCards: number;
};

type ImportedCardRow = {
  answer: string;
  evidenceCount: number;
  externalId: string | null;
  importFile: string | null;
  question: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
  verificationStatus: string | null;
};

const importFileWhere = sql`
  (
    scs.source_metadata->>'importFile' ilike '%private-pilot-acs-expanded-official-stack%'
    or scs.source_metadata->>'importFile' ilike '%ifr-expanded-official-stack%'
    or scs.source_metadata->>'importFile' ilike '%comptia-security-plus-sy0-701-expanded-needs-source-verification-2026-06-13%'
    or scs.source_metadata->>'importFile' ilike '%real-estate-national-core-salesperson-expanded-2026-06-14%'
    or scs.source_metadata->>'importFile' ilike '%texas-sales-agent-state-delta-expanded-2026-06-14%'
    or scs.source_metadata->>'importFile' ilike '%next-study-decks-2026-06-19%'
  )
  and scs.source_metadata->>'importFile' not ilike '%nclex-rn-pn-final-all-source-remediated-canonical%'
  and scs.source_metadata->>'importFile' not ilike '%quarantine%'
`;

async function getImportedDecks(query: string) {
  const queryFilter = query
    ? sql`and (sd.title ilike ${`%${query}%`} or coalesce(sd.subject, '') ilike ${`%${query}%`})`
    : sql``;

  const result = await getDb().execute(sql`
    select
      sd.id as "deckId",
      sd.title,
      sd.subject,
      sd.card_count::int as "cardCount",
      sd.is_public as "isPublic",
      sd.is_official as "isOfficial",
      sd.verified_card_count::int as "verifiedCards",
      count(distinct sc.id)::int as "importedCards",
      count(distinct scs.id)::int as "sourceRows",
      count(distinct sv.id)::int as "verificationRows"
    from study_decks sd
    join study_cards sc on sc.deck_id = sd.id
    join study_card_sources scs on scs.card_id = sc.id
    left join study_verifications sv on sv.card_id = sc.id
    where ${importFileWhere}
      ${queryFilter}
    group by sd.id
    order by sd.title asc
  `);

  return result.rows as ImportedDeckRow[];
}

async function getImportedStacks(query: string) {
  const queryFilter = query
    ? sql`and (sds.title ilike ${`%${query}%`} or coalesce(sds.subject, '') ilike ${`%${query}%`})`
    : sql``;

  const result = await getDb().execute(sql`
    select
      sds.id as "stackId",
      sds.title,
      sds.subject,
      sds.is_public as "isPublic",
      sds.is_official as "isOfficial",
      count(distinct sd.id)::int as "deckCount",
      count(distinct sc.id)::int as "cardCount",
      count(distinct case when sc.is_verified then sc.id end)::int as "verifiedCards"
    from study_deck_stacks sds
    join study_deck_stack_items sdsi on sdsi.stack_id = sds.id
    join study_decks sd on sd.id = sdsi.deck_id
    join study_cards sc on sc.deck_id = sd.id
    join study_card_sources scs on scs.card_id = sc.id
    where ${importFileWhere}
      ${queryFilter}
    group by sds.id
    order by sds.title asc
  `);

  return result.rows as ImportedStackRow[];
}

async function getImportedCards(deckId: string) {
  const result = await getDb().execute(sql`
    select
      sc.question,
      sc.answer,
      scs.source_label as "sourceLabel",
      scs.source_url as "sourceUrl",
      scs.source_metadata->>'externalId' as "externalId",
      scs.source_metadata->>'importFile' as "importFile",
      scs.source_metadata->'verification'->>'status' as "verificationStatus",
      jsonb_array_length(coalesce(scs.source_metadata->'verification'->'evidence', '[]'::jsonb))::int as "evidenceCount"
    from study_cards sc
    join study_card_sources scs on scs.card_id = sc.id
    where sc.deck_id = ${deckId}
      and ${importFileWhere}
    order by sc.position asc, sc.created_at asc
    limit 12
  `);

  return result.rows as ImportedCardRow[];
}

export default async function LocalStudyImportReviewPage({ searchParams }: Props) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { deck, q } = await searchParams;
  const query = q?.trim() ?? "";
  const [decks, stacks] = await Promise.all([getImportedDecks(query), getImportedStacks(query)]);
  const selectedDeck = decks.find((item) => item.deckId === deck) ?? decks[0];
  const cards = selectedDeck ? await getImportedCards(selectedDeck.deckId) : [];
  const totalCards = decks.reduce((sum, item) => sum + item.importedCards, 0);
  const officialDecks = decks.filter((item) => item.isOfficial).length;
  const publicDecks = decks.filter((item) => item.isPublic).length;
  const verifiedCards = decks.reduce((sum, item) => sum + item.verifiedCards, 0);

  return (
    <div className="screen study-dashboard-screen">
      <div className="screen-toolbar">
        <Link className="back-button" href="/study/library">
          <ChevronLeft size={16} aria-hidden="true" />
          Library
        </Link>
        <div>
          <p className="eyebrow">Local Study Import</p>
          <h1>Ready Content Review</h1>
          <p>Local-only view of unpublished imported Study stacks and decks. This page does not publish, verify, or mark anything official.</p>
        </div>
      </div>

      <section className="study-stat-strip" aria-label="Local import totals">
        <div className="study-stat-chip">
          <strong>{stacks.length}</strong>
          <span>Stacks</span>
        </div>
        <div className="study-stat-chip">
          <strong>{decks.length}</strong>
          <span>Decks</span>
        </div>
        <div className="study-stat-chip">
          <strong>{totalCards}</strong>
          <span>Cards</span>
        </div>
        <div className="study-stat-chip">
          <strong>{officialDecks}</strong>
          <span>Official</span>
        </div>
        <div className="study-stat-chip">
          <strong>{publicDecks}</strong>
          <span>Public</span>
        </div>
        <div className="study-stat-chip">
          <strong>{verifiedCards}</strong>
          <span>App verified</span>
        </div>
      </section>

      <section className="panel">
        <form action="/study/local-import-review" className="study-library-search">
          <label>
            <span>Search imported decks</span>
            <input defaultValue={query} name="q" placeholder="Private Pilot, Security+, Real Estate..." type="search" />
          </label>
          <div className="study-library-search__actions">
            <button type="submit">Apply</button>
            {query && (
              <Link className="button-link secondary" href="/study/local-import-review">
                Clear
              </Link>
            )}
            <span>
              {stacks.length} stack{stacks.length === 1 ? "" : "s"} - {decks.length} deck{decks.length === 1 ? "" : "s"}
            </span>
          </div>
        </form>
      </section>

      {selectedDeck ? (
        <>
          {stacks.length > 0 && (
            <>
              <section className="section-head">
                <div>
                  <p className="eyebrow">Stacks</p>
                  <h2>Imported study paths</h2>
                </div>
              </section>
              <section className="study-deck-grid" aria-label="Imported Study stacks">
                {stacks.map((item) => (
                  <article className="study-deck-card" key={item.stackId}>
                    <div className="study-deck-card__header">
                      <span className="badge">Local</span>
                      {!item.isPublic && <span className="badge">Unpublished</span>}
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.subject ?? "No subject label"}</p>
                    <div className="study-deck-card__footer">
                      <span>{item.deckCount} decks</span>
                      <span>{item.cardCount} cards</span>
                      <span>Official: {item.isOfficial ? "yes" : "no"}</span>
                      <span>App verified: {item.verifiedCards}</span>
                    </div>
                  </article>
                ))}
              </section>
            </>
          )}

          <section className="section-head">
            <div>
              <p className="eyebrow">Decks</p>
              <h2>Imported deck list</h2>
            </div>
          </section>
          <section className="study-deck-grid" aria-label="Imported Study decks">
            {decks.map((item) => (
              <Link
                className="study-deck-card"
                href={`/study/local-import-review?deck=${item.deckId}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                key={item.deckId}
              >
                <div className="study-deck-card__header">
                  <span className="badge">Local</span>
                  {!item.isPublic && <span className="badge">Unpublished</span>}
                </div>
                <h3>{item.title}</h3>
                <p>{item.subject ?? "No subject label"}</p>
                <div className="study-deck-card__footer">
                  <span>{item.importedCards} cards</span>
                  <span>{item.sourceRows} sources</span>
                  <span>{item.verificationRows} verification rows</span>
                </div>
              </Link>
            ))}
          </section>

          <section className="panel">
            <p className="eyebrow">Selected Deck</p>
            <h2>{selectedDeck.title}</h2>
            <div className="study-deck-card__footer">
              <span className="badge">{selectedDeck.importedCards} cards</span>
              <span className="badge">{selectedDeck.sourceRows} source rows</span>
              <span className="badge">{selectedDeck.verificationRows} verification rows</span>
              <span className="badge">Official: {selectedDeck.isOfficial ? "yes" : "no"}</span>
              <span className="badge">Public: {selectedDeck.isPublic ? "yes" : "no"}</span>
              <span className="badge">App verified cards: {selectedDeck.verifiedCards}</span>
            </div>
          </section>

          <section className="study-deck-grid" aria-label="Sample imported cards">
            {cards.map((card) => (
              <article className="study-deck-card" key={card.externalId ?? card.question}>
                <div className="study-deck-card__header">
                  <span className="badge">{card.verificationStatus ?? "verification metadata"}</span>
                  <span className="badge">{card.evidenceCount} evidence</span>
                </div>
                <h3>{card.question}</h3>
                <p>{card.answer}</p>
                <div className="study-deck-card__footer">
                  {card.sourceLabel && <span>{card.sourceLabel}</span>}
                  {card.externalId && <span>{card.externalId}</span>}
                </div>
                {card.sourceUrl && (
                  <Link className="button-link secondary" href={card.sourceUrl}>
                    Source
                  </Link>
                )}
              </article>
            ))}
          </section>
        </>
      ) : (
        <section className="panel study-empty-panel">
          <h2>No imported decks found.</h2>
          <p>Clear the search, or rerun the local Study ready importer.</p>
        </section>
      )}
    </div>
  );
}
