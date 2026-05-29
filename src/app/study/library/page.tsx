export const dynamic = "force-dynamic";

import Link from "next/link";
import { BookOpen } from "lucide-react";

import { auth } from "@/auth";
import {
  getStudyAudienceTags,
  getStudyLibraryDecks,
  getStudyRootSubjects,
  type StudyLibraryScope,
} from "@/features/study/study-data";
import { StudyDeckCard } from "@/features/study/study-deck-card";

type Props = {
  searchParams: Promise<{ official?: string; q?: string; scope?: string; subject?: string; tag?: string }>;
};

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
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

  const [filteredDecks, subjects, audienceTags] = await Promise.all([
    getStudyLibraryDecks({
      officialOnly,
      query,
      scope: scopeFilter,
      subject: subjectFilter || undefined,
      tag: tagFilter || undefined,
      userId,
    }),
    getStudyRootSubjects(),
    getStudyAudienceTags(),
  ]);

  const deckSubjects = Array.from(
    new Set(filteredDecks.map((deck) => deck.subject?.trim()).filter((value): value is string => Boolean(value))),
  );
  const taxonomySubjects = subjects.map((item) => item.name);
  const subjectOptions = Array.from(new Set([...taxonomySubjects, ...deckSubjects])).sort((a, b) =>
    a.localeCompare(b),
  );
  const tags = Array.from(
    new Set(
      filteredDecks
        .flatMap((deck) => deck.tags ?? [])
        .map((value) => value.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const hasFilters = Boolean(query || subjectFilter || tagFilter || officialOnly);

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
          <p>Browse by subject, keyword, and official decks.</p>
        </div>
      </section>

      <section className="panel">
        <form action="/study/library" className="study-deck-form">
          <label>
            <span>Scope</span>
            <select defaultValue={scopeFilter} name="scope">
              <option value="all">All public decks</option>
              <option value="official">Official decks</option>
              {userId && <option value="mine">My public decks</option>}
            </select>
          </label>

          <label>
            <span>Search</span>
            <input defaultValue={q ?? ""} name="q" placeholder="Search title, subject, tags..." type="text" />
          </label>

          <label>
            <span>Subject</span>
            <select defaultValue={subjectFilter || ""} name="subject">
              <option value="">All subjects</option>
              {subjectOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Tag</span>
            <select defaultValue={tagFilter || ""} name="tag">
              <option value="">All tags</option>
              {audienceTags.map((value) => (
                <option key={value.id} value={value.label}>
                  {value.label}
                </option>
              ))}
              {tags.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="study-check-label">
            <input defaultChecked={officialOnly} name="official" type="checkbox" value="1" />
            <span>Official decks only</span>
          </label>

          <div className="inline-actions">
            <button type="submit">Apply</button>
            {hasFilters && (
              <Link className="button-link secondary" href="/study/library">
                Clear
              </Link>
            )}
          </div>
        </form>
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
