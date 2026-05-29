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
  searchParams: Promise<{ official?: string; q?: string; scope?: string; subject?: string; tag?: string }>;
};

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function cleanParam(value: string | null | undefined) {
  return value?.trim() || undefined;
}

export default async function StudyLibraryPage({ searchParams }: Props) {
  const { official, q, scope, subject, tag } = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;
  const query = normalize(q);
  const subjectFilter = normalize(subject);
  const tagFilter = normalize(tag);
  const officialOnly = official === "1";
  const scopeFilter: StudyLibraryScope =
    scope === "mine" || scope === "official" || scope === "all"
      ? scope
      : "all";

  const [filteredDecks, optionDecks, subjectTaxonomyOptions, audienceTags] = await Promise.all([
    getStudyLibraryDecks({
      officialOnly,
      query,
      scope: scopeFilter,
      subject: subjectFilter || undefined,
      tag: tagFilter || undefined,
      userId,
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

  const hasFilters = Boolean(query || subjectFilter || tagFilter || officialOnly || scopeFilter !== "all");
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
  }) {
    const params = new URLSearchParams();
    const nextScope = next.scope === undefined ? scopeFilter : next.scope;
    const nextQuery = next.q === undefined ? cleanParam(q) : cleanParam(next.q);
    const nextSubject = next.subject === undefined ? cleanParam(subject) : cleanParam(next.subject);
    const nextTag = next.tag === undefined ? cleanParam(tag) : cleanParam(next.tag);
    const nextOfficial = next.official === undefined ? official : next.official;

    if (nextScope && nextScope !== "all") params.set("scope", nextScope);
    if (nextQuery) params.set("q", nextQuery);
    if (nextSubject) params.set("subject", nextSubject);
    if (nextTag) params.set("tag", nextTag);
    if (nextOfficial === "1") params.set("official", "1");

    const suffix = params.toString();
    return suffix ? `/study/library?${suffix}` : "/study/library";
  }

  return (
    <div className="screen study-dashboard-screen">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">QuesIQ Study</p>
          <h1>Library</h1>
          <p>Browse public Study decks shared across QuesIQ.</p>
        </div>
        <Link className="button-link secondary" href="/study">
          Study Home
        </Link>
      </div>

      <section className="panel study-library-heading">
        <BookOpen size={20} aria-hidden="true" />
        <div>
          <h2>{filteredDecks.length} public deck{filteredDecks.length === 1 ? "" : "s"}</h2>
          <p>Browse by subject, keyword, audience, and official status.</p>
        </div>
      </section>

      <section className="panel">
        <form action="/study/library" className="study-library-search">
          <label>
            <span>Search</span>
            <input defaultValue={q ?? ""} name="q" placeholder="Search title, description, subject, tags..." type="search" />
          </label>

          <label className="study-check-label">
            <input defaultChecked={officialOnly} name="official" type="checkbox" value="1" />
            <span>Official decks only</span>
          </label>

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
            <span>Scope</span>
            <div className="study-filter-pills">
              <Link className={scopeFilter === "all" ? "active" : ""} href={libraryHref({ scope: "all" })}>
                All public
              </Link>
              <Link className={scopeFilter === "official" ? "active" : ""} href={libraryHref({ scope: "official" })}>
                Official
              </Link>
              {userId && (
                <Link className={scopeFilter === "mine" ? "active" : ""} href={libraryHref({ scope: "mine" })}>
                  Mine
                </Link>
              )}
            </div>
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
              <p>Make one of your decks public from its edit screen to test the library.</p>
              <Link className="button-link" href="/study/decks">
                My Decks
              </Link>
            </>
          ) : (
            <>
              <h2>No decks match these filters.</h2>
              <p>Try broadening search or clearing one or more filters.</p>
              <Link className="button-link" href="/study/library">
                View All Public Decks
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
