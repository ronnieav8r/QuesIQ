export const dynamic = "force-dynamic";

import Link from "next/link";
import { BookOpen, BriefcaseBusiness, ChevronLeft, Database, GraduationCap, Layers3, Plus, Sparkles } from "lucide-react";

import { auth } from "@/auth";
import {
  getStudyLibraryDecks,
  getStudyStackCardStatsForStacks,
  getStudySubjectOptions,
  getVisibleStudyStacks,
  type StudyLibraryScope,
} from "@/features/study/study-data";
import { StudyDeckCard } from "@/features/study/study-deck-card";
import styles from "@/features/study/study-library.module.css";
import { StudyStackCard } from "@/features/study/study-stack-card";

type Props = {
  searchParams: Promise<{
    official?: string;
    path?: string;
    q?: string;
    scope?: string;
    subject?: string;
    subjectRoot?: string;
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

const studyPathOptions = [
  {
    body: "Licenses, certificates, and exam-oriented collections.",
    href: { path: "exams" },
    icon: GraduationCap,
    key: "exams",
    label: "Exams & Certifications",
    topics: [
      { label: "Private Pilot ASEL", params: { tag: "Private Pilot ASEL" } },
      { label: "Instrument Rating", params: { tag: "Instrument Rating Airplane" } },
      { label: "Security+", params: { q: "Security+" } },
      { label: "TEAS", params: { q: "TEAS" } },
      { label: "EMT", params: { q: "EMT" } },
      { label: "AP Psychology", params: { q: "AP Psychology" } },
    ],
  },
  {
    body: "Browse by academic area before choosing a topic.",
    href: { path: "school" },
    icon: BookOpen,
    key: "school",
    label: "School Subjects",
    topics: [
      { label: "Biology", params: { subjectRoot: "Biology" } },
      { label: "Chemistry", params: { subjectRoot: "Chemistry" } },
      { label: "Physics", params: { subjectRoot: "Physics" } },
      { label: "Psychology", params: { subjectRoot: "Psychology" } },
      { label: "Medicine & Health", params: { subjectRoot: "Medicine & Health" } },
    ],
  },
  {
    body: "Career prep, licensing, and job-aligned study paths.",
    href: { path: "careers" },
    icon: BriefcaseBusiness,
    key: "careers",
    label: "Careers & Licensing",
    topics: [
      { label: "Aviation", params: { subjectRoot: "Aviation" } },
      { label: "Real Estate Exam", params: { tag: "Real Estate Exam" } },
      { label: "Healthcare", params: { subjectRoot: "Medicine & Health" } },
      { label: "Information Technology", params: { q: "CompTIA" } },
      { label: "Law", params: { subjectRoot: "Law" } },
    ],
  },
  {
    body: "Curiosity, refreshers, and broad study collections.",
    href: { path: "general" },
    icon: Sparkles,
    key: "general",
    label: "General Interest",
    topics: [
      { label: "General / Curious", params: { tag: "General / Curious" } },
      { label: "Personal Interest", params: { tag: "Personal Interest" } },
      { label: "Study Library", params: {} },
    ],
  },
] as const;

type StudyPathKey = (typeof studyPathOptions)[number]["key"];

function normalizePath(path: string | undefined): StudyPathKey | null {
  const match = studyPathOptions.find((item) => item.key === path);
  return match?.key ?? null;
}

export default async function StudyLibraryPage({ searchParams }: Props) {
  const { official, path, q, scope, subject, subjectRoot, tag, verified } = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;
  const selectedPath = normalizePath(path);
  const query = normalize(q);
  const subjectFilter = normalize(subject);
  const subjectRootFilter = normalize(subjectRoot);
  const tagFilter = normalize(tag);
  const officialOnly = official === "1";
  const verifiedOnly = verified === "1";
  const scopeFilter = normalizeScope(scope);

  const [filteredDecks, optionDecks, subjectTaxonomyOptions, stacks] = await Promise.all([
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
    getVisibleStudyStacks(userId),
  ]);

  const deckSubjects = Array.from(
    new Set(optionDecks.map((deck) => deck.subject?.trim()).filter((value): value is string => Boolean(value))),
  );
  const taxonomyNames = new Set(subjectTaxonomyOptions.map((item) => item.name));
  const extraDeckSubjects = deckSubjects.filter((value) => !taxonomyNames.has(value));
  const stackStatsById = await getStudyStackCardStatsForStacks(
    stacks.map((stack) => stack.id),
    userId,
  );
  const stacksWithStats = stacks.map((stack) => ({
    ...stack,
    stats: stackStatsById.get(stack.id),
  }));
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
  const hasFilters = Boolean(
    selectedPath || query || subjectFilter || subjectRootFilter || tagFilter || officialOnly || verifiedOnly || scopeFilter !== "all",
  );
  const subjectOptions = [
    ...subjectTaxonomyOptions.map((value) => ({
      depth: value.depth,
      label: value.label,
      rootName: value.rootName,
      value: value.name,
    })),
    ...extraDeckSubjects.map((value) => ({ depth: 0, label: value, rootName: value, value })),
  ].sort((left, right) => left.label.trim().localeCompare(right.label.trim()));
  const subjectRootByName = new Map(subjectOptions.map((value) => [value.value.toLowerCase(), value.rootName.toLowerCase()]));

  function subjectMatchesRoot(value: string | null | undefined) {
    if (!subjectRootFilter) return true;
    const normalized = value?.trim().toLowerCase() ?? "";
    return normalized === subjectRootFilter || subjectRootByName.get(normalized) === subjectRootFilter;
  }

  const rootFilteredDecks = subjectFilter ? filteredDecks : filteredDecks.filter((deck) => subjectMatchesRoot(deck.subject));
  const rootFilteredStacks = subjectFilter ? filteredStacks : filteredStacks.filter((stack) => subjectMatchesRoot(stack.subject));
  const visibleDecks = subjectRootFilter ? rootFilteredDecks : filteredDecks;
  const visibleStacks = subjectRootFilter ? rootFilteredStacks : filteredStacks;
  const visibleTotalResults = visibleStacks.length + visibleDecks.length;
  const visibleResultLabel = `${visibleTotalResults} result${visibleTotalResults === 1 ? "" : "s"}`;

  function libraryHref(next: {
    official?: string | null;
    path?: string | null;
    q?: string | null;
    scope?: StudyLibraryScope | null;
    subject?: string | null;
    subjectRoot?: string | null;
    tag?: string | null;
    verified?: string | null;
  }) {
    const params = new URLSearchParams();
    const nextPath = next.path === undefined ? selectedPath : next.path;
    const nextScope = next.scope === undefined ? scopeFilter : next.scope;
    const nextQuery = next.q === undefined ? cleanParam(q) : cleanParam(next.q);
    const nextSubjectRoot = next.subjectRoot === undefined ? cleanParam(subjectRoot) : cleanParam(next.subjectRoot);
    const nextSubject = next.subject === undefined ? cleanParam(subject) : cleanParam(next.subject);
    const nextTag = next.tag === undefined ? cleanParam(tag) : cleanParam(next.tag);
    const nextOfficial = next.official === undefined ? official : next.official;
    const nextVerified = next.verified === undefined ? verified : next.verified;

    if (nextPath) params.set("path", nextPath);
    if (nextScope && nextScope !== "all") params.set("scope", nextScope);
    if (nextQuery) params.set("q", nextQuery);
    if (nextSubjectRoot) params.set("subjectRoot", nextSubjectRoot);
    if (nextSubject) params.set("subject", nextSubject);
    if (nextTag) params.set("tag", nextTag);
    if (nextOfficial === "1") params.set("official", "1");
    if (nextVerified === "1") params.set("verified", "1");

    const suffix = params.toString();
    return suffix ? `/study/library?${suffix}` : "/study/library";
  }

  const selectedPathOption = selectedPath
    ? studyPathOptions.find((item) => item.key === selectedPath)
    : null;

  return (
    <div className="screen study-dashboard-screen">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">QuesIQ Study</p>
          <h1>Library</h1>
          <p>Browse stacks or open any deck directly, including decks that also belong to a stack.</p>
        </div>
        <div className="inline-actions">
          {process.env.NODE_ENV !== "production" && (
            <Link className="button-link secondary" href="/study/local-import-review">
              <Database size={14} aria-hidden="true" />
              Local Import Review
            </Link>
          )}
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
            {visibleStacks.length} stack{visibleStacks.length === 1 ? "" : "s"} - {visibleDecks.length} deck{visibleDecks.length === 1 ? "" : "s"}
          </h2>
          <p>Open a stack to study all included decks together, or open a deck directly.</p>
        </div>
      </section>

      <section className="panel">
        <form action="/study/library" className="study-library-search">
          <label>
            <span>Search</span>
            <input defaultValue={q ?? ""} name="q" placeholder="Search title, description, subject, tags..." type="search" />
          </label>
          {selectedPath && <input name="path" type="hidden" value={selectedPath} />}
          {scopeFilter !== "all" && <input name="scope" type="hidden" value={scopeFilter} />}
          {subjectRootFilter && <input name="subjectRoot" type="hidden" value={subjectRoot ?? ""} />}
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
            <span>{visibleResultLabel}</span>
          </div>
        </form>
      </section>

      <section className={`panel ${styles.pathBrowser}`} aria-label="Browse by study path">
        <div className={styles.pathHeader}>
          <div>
            <p className="eyebrow">Browse</p>
            <h2>{selectedPathOption ? selectedPathOption.label : "Choose a study path"}</h2>
          </div>
          {selectedPathOption && (
            <Link
              className={styles.pathBack}
              href={libraryHref({ path: null, q: null, subject: null, subjectRoot: null, tag: null })}
            >
              <ChevronLeft aria-hidden="true" size={16} />
              Back to paths
            </Link>
          )}
        </div>

        {!selectedPathOption && (
          <div className={styles.pathGrid}>
            {studyPathOptions.map((item) => (
              <Link
                className={styles.pathCard}
                href={libraryHref({ path: item.key, q: null, subject: null, subjectRoot: null, tag: null })}
                key={item.key}
              >
                <item.icon aria-hidden="true" size={18} />
                <strong>{item.label}</strong>
                <span>{item.body}</span>
              </Link>
            ))}
          </div>
        )}

        {selectedPathOption ? (
          <div className={styles.topicRail}>
            <div className={styles.topicRailHeader}>
              <span>Choices in this path</span>
            </div>
            <div className={styles.topicChips}>
              {selectedPathOption.topics.map((topic) => {
                const topicQuery = "q" in topic.params ? topic.params.q : null;
                const topicSubjectRoot = "subjectRoot" in topic.params ? topic.params.subjectRoot : null;
                const topicTag = "tag" in topic.params ? topic.params.tag : null;
                return (
                  <Link
                    className={styles.topicChip}
                    href={libraryHref({
                      path: selectedPath,
                      q: topicQuery,
                      subject: null,
                      subjectRoot: topicSubjectRoot,
                      tag: topicTag,
                  })}
                  key={topic.label}
                >
                    <span>{topic.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <p className={styles.pathHint}>Start broad, then tap a popular pick. Search still works when you know exactly what you want.</p>
        )}

        <details className={styles.advancedFilters} open={Boolean(scopeFilter !== "all" || officialOnly || verifiedOnly)}>
          <summary>Visibility and trust filters</summary>
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
          </div>
        </details>
      </section>

      {visibleTotalResults === 0 ? (
        <section className="panel study-empty-panel">
          {!hasFilters ? (
            <>
              <h2>No Study library items yet.</h2>
              <p>Public and Official stacks or decks will appear here after curation.</p>
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
          {visibleStacks.length > 0 && (
            <>
              <section className="section-head">
                <div>
                  <p className="eyebrow">Stacks</p>
                  <h2>Study paths</h2>
                </div>
              </section>
              <section className="study-deck-grid" aria-label="Study stacks">
                {visibleStacks.map((stack) => (
                  <StudyStackCard currentUserId={userId} key={stack.id} stack={stack} />
                ))}
              </section>
            </>
          )}

          {visibleDecks.length > 0 && (
            <>
              <section className="section-head">
                <div>
                  <p className="eyebrow">Decks</p>
                  <h2>Open a deck directly</h2>
                </div>
              </section>
              <section className="study-deck-grid" aria-label="Study decks">
                {visibleDecks.map((deck) => (
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
