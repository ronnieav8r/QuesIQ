export const dynamic = "force-dynamic";

import Link from "next/link";
import { BookOpen } from "lucide-react";

import { auth } from "@/auth";
import {
  getStudyAudienceTags,
  getStudyLibraryDecks,
  getStudySubjectOptions,
  type StudyLibraryScope,
} from "@/features/study/study-data";
import { StudyDeckCard } from "@/features/study/study-deck-card";

type Props = {
  searchParams: Promise<{
    official?: string;
    q?: string;
    scope?: string;
    subject?: string;
    tag?: string;
    verified?: string;
  }>;
};

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function cleanParam(value: string | null | undefined) {
  return value?.trim() || undefined;
}

function normalizeScope(scope: string | undefined): StudyLibraryScope {
  if (scope === "mine") {
    return "mine";
  }
  return "all";
}

export default async function StudyLibraryPage({ searchParams }: Props) {
  const { official, q, scope, subject, tag, verified } = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;
  const query = normalize(q);
  const subjectFilter = normalize(subject);
  const tagFilter = normalize(tag);
  const officialOnly = official === "1";
  const verifiedOnly = verified === "1";
  const scopeFilter = normalizeScope(scope);

  const [filteredDecks, optionDecks, subjectTaxonomyOptions, audienceTags] = await Promise.all([
    getStudyLibraryDecks({
      officialOnly,
      query,
      scope: scopeFilter,
      subject: subjectFilter || undefined,
      tag: tagFilter || undefined,
      userId,
      verifiedOnly,
    }),
    getStudyLibraryDecks({
      scope: scopeFilter,
      userId,
    }),
    getStudySubjectOptions(),
    getStudyAudienceTags(),
  ]);

  const deckSubjects = Array.from(
    new Set(optionDecks.map((deck) => deck.subject?.trim()).filter((value): value is string => Boolean(value))),
  );
  const taxonomyNames = new Set(subjectTaxonomyOptions.map((item) => item.name));
  const extraDeckSubjects = deckSubjects.filter((value) => !taxonomyNames.has(value));
  const tags = Array.from(
    new Set(
      optionDecks
        .flatMap((deck) => deck.tags ?? [])
        .map((value) => value.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const hasFilters = Boolean(
    query || subjectFilter || tagFilter || officialOnly || verifiedOnly || scopeFilter !== "all",
  );
  const resultLabel = `${filteredDecks.length} result${filteredDecks.length === 1 ? "" : "s"}`;
  const subjectOptions = [
    ...subjectTaxonomyOptions.map((value) => ({ label: value.label, value: value.name })),
    ...extraDeckSubjects.map((value) => ({ label: value, value })),
  ];
  const tagOptions = [
    ...audienceTags.map((value) => ({ label: value.label, value: value.label })),
    ...tags
      .filter((value) => !audienceTags.some((audienceTag) => audienceTag.label.toLowerCase() === value.toLowerCase()))
      .map((value) => ({ label: value, value })),
  ];

  function libraryHref(next: {
    official?: string | null;
    q?: string | null;
    scope?: StudyLibraryScope | null;
    subject?: string | null;
    tag?: string | null;
    verified?: string | null;
  }) {
    const params = new URLSearchParams();
    const nextScope = next.scope === undefined ? scopeFilter : next.scope;
    const nextQuery = next.q === undefined ? cleanParam(q) : cleanParam(next.q);
    const nextSubject = next.subject === undefined ? cleanParam(subject) : cleanParam(next.subject);
    const nextTag = next.tag === undefined ? cleanParam(tag) : cleanParam(next.tag);
    const nextOfficial = next.official === undefined ? official : next.official;
    const nextVerified = next.verified === undefined ? verified : next.verified;

    if (nextScope && nextScope !== "all") params.set("scope", nextScope);
    if (nextQuery) params.set("q", nextQuery);
    if (nextSubject) params.set("subject", nextSubject);
    if (nextTag) params.set("tag", nextTag);
    if (nextOfficial === "1") params.set("official", "1");
    if (nextVerified === "1") params.set("verified", "1");

    const suffix = params.toString();
    return suffix ? `/study/library?${suffix}` : "/study/library";
  }

  return (
    <div className="screen study-dashboard-screen">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">QuesIQ Study</p>
          <h1>Library</h1>
          <p>Browse Public decks, your Mine collection, and QuesIQ-reviewed Study material.</p>
        </div>
        <Link className="button-link secondary" href="/study">
          Study Home
        </Link>
      </div>

      <section className="panel study-library-heading">
        <BookOpen size={20} aria-hidden="true" />
        <div>
          <h2>{filteredDecks.length} deck{filteredDecks.length === 1 ? "" : "s"}</h2>
          <p>V1 labels are Mine, Public, Official, and Verified. Verified means source/card review, not a credential.</p>
        </div>
      </section>

      <section className="panel">
        <form action="/study/library" className="study-library-search">
          <label>
            <span>Search</span>
            <input defaultValue={q ?? ""} name="q" placeholder="Search title, description, subject, tags..." type="search" />
          </label>
          {scopeFilter !== "all" && <input name="scope" type="hidden" value={scopeFilter} />}
          {subjectFilter && <input name="subject" type="hidden" value={subjectFilter} />}
          {tagFilter && <input name="tag" type="hidden" value={tagFilter} />}
          {officialOnly && <input name="official" type="hidden" value="1" />}
          {verifiedOnly && <input name="verified" type="hidden" value="1" />}

          <div className="study-library-search__actions">
            <button type="submit">Apply</button>
            {hasFilters && (
              <Link className="button-link secondary" href="/study/library">
                Clear
              </Link>
            )}
            <span>{resultLabel}</span>
          </div>
        </form>

        <div className="study-library-filter-groups">
          <div className="study-library-filter-group">
            <span>Ownership & Visibility</span>
            <div className="study-filter-pills">
              <Link className={scopeFilter === "all" ? "active" : ""} href={libraryHref({ scope: "all" })}>
                {userId ? "Public + Mine" : "Public"}
              </Link>
              {userId && (
                <Link className={scopeFilter === "mine" ? "active" : ""} href={libraryHref({ scope: "mine" })}>
                  Mine
                </Link>
              )}
            </div>
          </div>

          <div className="study-library-filter-group">
            <span>Trust & Source</span>
            <div className="study-filter-pills">
              <Link
                className={!officialOnly && !verifiedOnly ? "active" : ""}
                href={libraryHref({ official: null, verified: null })}
              >
                Any
              </Link>
              <Link className={officialOnly ? "active" : ""} href={libraryHref({ official: "1", verified: null })}>
                Official
              </Link>
              <Link className={verifiedOnly ? "active" : ""} href={libraryHref({ official: null, verified: "1" })}>
                Verified
              </Link>
            </div>
            <p className="field-note">Official is QuesIQ-curated. Verified is card/source checked.</p>
          </div>

          <div className="study-library-filter-group">
            <span>Subject</span>
            <div className="study-filter-pills">
              <Link className={!subjectFilter ? "active" : ""} href={libraryHref({ subject: null })}>
                All
              </Link>
              {subjectOptions.map((value) => (
                <Link
                  className={subjectFilter === value.value.toLowerCase() ? "active" : ""}
                  href={libraryHref({ subject: value.value })}
                  key={value.value}
                >
                  {value.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="study-library-filter-group">
            <span>Audience & Tags</span>
            <div className="study-filter-pills">
              <Link className={!tagFilter ? "active" : ""} href={libraryHref({ tag: null })}>
                All
              </Link>
              {tagOptions.map((value) => (
                <Link
                  className={tagFilter === value.value.toLowerCase() ? "active" : ""}
                  href={libraryHref({ tag: value.value })}
                  key={value.value}
                >
                  {value.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {filteredDecks.length === 0 ? (
        <section className="panel study-empty-panel">
          {filteredDecks.length === 0 && !hasFilters ? (
            <>
              <h2>No public decks yet.</h2>
              <p>Public and Official Study decks will appear here after deck curation or when you share one of your own.</p>
              <Link className="button-link" href="/study/decks">
                My Decks
              </Link>
            </>
          ) : (
            <>
              <h2>No decks match these filters.</h2>
              <p>Try clearing a trust label, removing the subject or tag, or searching a broader term.</p>
              <Link className="button-link" href="/study/library">
                Clear Filters
              </Link>
            </>
          )}
        </section>
      ) : (
        <section className="study-deck-grid" aria-label="Public Study decks">
          {filteredDecks.map((deck) => (
            <StudyDeckCard currentUserId={userId} deck={deck} key={deck.id} />
          ))}
        </section>
      )}
    </div>
  );
}
