export const dynamic = "force-dynamic";

import Link from "next/link";
import { BookOpen, Layers3, Plus } from "lucide-react";

import { auth } from "@/auth";
import {
  getStudyAudienceTags,
  getStudyLibraryDecks,
  getStudyStackCardStatsForStacks,
  getStudySubjectOptions,
  getVisibleStudyStackDeckIds,
  getVisibleStudyStacks,
  type StudyLibraryScope,
} from "@/features/study/study-data";
import { StudyDeckCard } from "@/features/study/study-deck-card";
import styles from "@/features/study/study-library.module.css";
import { StudyStackCard } from "@/features/study/study-stack-card";

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

  const [filteredDecks, optionDecks, subjectTaxonomyOptions, audienceTags, stacks, stackedDeckIds] = await Promise.all([
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
    getVisibleStudyStacks(userId),
    getVisibleStudyStackDeckIds(userId),
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

  const stackStatsById = await getStudyStackCardStatsForStacks(
    stacks.map((stack) => stack.id),
    userId,
  );
  const stacksWithStats = stacks.map((stack) => ({
    ...stack,
    stats: stackStatsById.get(stack.id),
  }));
  const stackedDeckIdSet = new Set(stackedDeckIds);
  const filteredStacks = stacksWithStats.filter((stack) => {
    if (scopeFilter === "mine" && (!userId || stack.userId !== userId)) {
      return false;
    }
    if (scopeFilter !== "mine" && !stack.isPublic) {
      return false;
    }
    if (officialOnly && !stack.isOfficial) {
      return false;
    }
    if (verifiedOnly && (stack.cardCount <= 0 || (stack.verifiedCardCount ?? 0) !== stack.cardCount)) {
      return false;
    }
    if (subjectFilter && (stack.subject?.trim().toLowerCase() ?? "") !== subjectFilter) {
      return false;
    }
    if (tagFilter && (stack.subject?.trim().toLowerCase() ?? "") !== tagFilter) {
      return false;
    }
    if (!query) {
      return true;
    }
    return [stack.title, stack.description ?? "", stack.subject ?? ""].join(" ").toLowerCase().includes(query);
  });
  const standaloneDecks = filteredDecks.filter((deck) => !stackedDeckIdSet.has(deck.id));
  const totalResults = filteredStacks.length + standaloneDecks.length;
  const hasFilters = Boolean(
    query || subjectFilter || tagFilter || officialOnly || verifiedOnly || scopeFilter !== "all",
  );
  const resultLabel = `${totalResults} result${totalResults === 1 ? "" : "s"}`;
  const subjectOptions = [
    ...subjectTaxonomyOptions.map((value) => ({ label: value.label, value: value.name })),
    ...extraDeckSubjects.map((value) => ({ label: value, value })),
  ];
  const audienceTagOptions = audienceTags.map((value) => ({ label: value.label, value: value.label }));
  const deckTagOptions = tags
    .filter((value) => !audienceTags.some((audienceTag) => audienceTag.label.toLowerCase() === value.toLowerCase()))
    .map((value) => ({ label: value, value }));
  const primaryAudienceTagOptions = audienceTagOptions.slice(0, 8);
  const overflowAudienceTagOptions = audienceTagOptions.slice(8);
  const tagOptions = [...audienceTagOptions, ...deckTagOptions];
  const activeTagOption = tagFilter
    ? tagOptions.find((value) => value.value.toLowerCase() === tagFilter)
    : undefined;
  const moreTagCount = overflowAudienceTagOptions.length + deckTagOptions.length;

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
          <p>Browse stacks first, then standalone decks that are not already inside a stack.</p>
        </div>
        <div className="inline-actions">
          {userId && (
            <Link className="button-link secondary" href="/study/stacks/new">
              <Layers3 size={14} aria-hidden="true" />
              New Stack
            </Link>
          )}
          {userId && (
            <Link className="button-link" href="/study/decks/new">
              <Plus size={14} aria-hidden="true" />
              New Deck
            </Link>
          )}
        </div>
      </div>

      <section className="panel study-library-heading">
        <BookOpen size={20} aria-hidden="true" />
        <div>
          <h2>
            {filteredStacks.length} stack{filteredStacks.length === 1 ? "" : "s"} - {standaloneDecks.length} standalone deck{standaloneDecks.length === 1 ? "" : "s"}
          </h2>
          <p>Open a stack to study all included decks together, or open a standalone deck directly.</p>
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
            <span>Audience / Exam</span>
            <div className="study-filter-pills">
              <Link className={!tagFilter ? "active" : ""} href={libraryHref({ tag: null })}>
                All
              </Link>
              {primaryAudienceTagOptions.map((value) => (
                <Link
                  className={tagFilter === value.value.toLowerCase() ? "active" : ""}
                  href={libraryHref({ tag: value.value })}
                  key={value.value}
                >
                  {value.label}
                </Link>
              ))}
              {activeTagOption &&
                !primaryAudienceTagOptions.some((value) => value.value.toLowerCase() === activeTagOption.value.toLowerCase()) && (
                  <Link className="active" href={libraryHref({ tag: activeTagOption.value })}>
                    {activeTagOption.label}
                  </Link>
                )}
            </div>
          </div>

          {moreTagCount > 0 && (
            <details className={styles.filterMore} open={Boolean(tagFilter)}>
              <summary>
                <span>More audience and tags</span>
                <small>{moreTagCount} filters</small>
              </summary>
              <div className={styles.filterMoreBody}>
                {overflowAudienceTagOptions.length > 0 && (
                  <div className="study-library-filter-group">
                    <span>Additional Audience / Exam</span>
                    <div className="study-filter-pills">
                      {overflowAudienceTagOptions.map((value) => (
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
                )}

                {deckTagOptions.length > 0 && (
                  <div className="study-library-filter-group">
                    <span>Topic Tags</span>
                    <div className={`study-filter-pills ${styles.compactPills}`}>
                      {deckTagOptions.map((value) => (
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
                )}
              </div>
            </details>
          )}
        </div>
      </section>

      {totalResults === 0 ? (
        <section className="panel study-empty-panel">
          {!hasFilters ? (
            <>
              <h2>No Study library items yet.</h2>
              <p>Public and Official stacks or standalone decks will appear here after curation.</p>
              <Link className="button-link" href="/study/decks/new">
                Create Deck
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
        <>
          {filteredStacks.length > 0 && (
            <>
              <section className="section-head">
                <div>
                  <p className="eyebrow">Stacks</p>
                  <h2>Study paths</h2>
                </div>
              </section>
              <section className="study-deck-grid" aria-label="Study stacks">
                {filteredStacks.map((stack) => (
                  <StudyStackCard currentUserId={userId} key={stack.id} stack={stack} />
                ))}
              </section>
            </>
          )}

          {standaloneDecks.length > 0 && (
            <>
              <section className="section-head">
                <div>
                  <p className="eyebrow">Standalone Decks</p>
                  <h2>Decks not in a stack</h2>
                </div>
              </section>
              <section className="study-deck-grid" aria-label="Standalone Study decks">
                {standaloneDecks.map((deck) => (
                  <StudyDeckCard currentUserId={userId} deck={deck} key={deck.id} />
                ))}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
