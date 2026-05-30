import Link from "next/link";

import { AdminView } from "@/components/interview/admin-view";
import { getStudyLibraryDecks } from "@/features/study/study-data";
import { listDpeContentSummary } from "@/server/dpe/dpe-data";

type AdminProduct = "dpe" | "interview" | "overview" | "study";

const adminProducts: { key: AdminProduct; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "interview", label: "Interview" },
  { key: "study", label: "Study" },
  { key: "dpe", label: "DPE" },
];

function normalizeProduct(product?: string): AdminProduct {
  return adminProducts.some((item) => item.key === product)
    ? (product as AdminProduct)
    : "overview";
}

export async function AdminConsole({ product }: { product?: string }) {
  const activeProduct = normalizeProduct(product);

  return (
    <section className="screen admin-screen" aria-labelledby="admin-console-title">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">QuesIQ Admin</p>
          <h1 id="admin-console-title">Admin Console</h1>
        </div>
      </div>

      <nav className="admin-tabs" aria-label="Admin products">
        {adminProducts.map((item) => (
          <Link
            aria-current={activeProduct === item.key ? "page" : undefined}
            className={activeProduct === item.key ? "active" : undefined}
            href={item.key === "overview" ? "/admin" : `/admin?product=${item.key}`}
            key={item.key}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {activeProduct === "overview" && <AdminOverview />}
      {activeProduct === "interview" && (
        <AdminView eyebrow="Interview Admin" title="Interview Admin" />
      )}
      {activeProduct === "study" && <StudyAdminPanel />}
      {activeProduct === "dpe" && <DpeAdminPanel />}
    </section>
  );
}

function AdminOverview() {
  return (
    <section className="ai-runs-panel" aria-labelledby="admin-overview-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Products</p>
          <h2 id="admin-overview-title">One place for product operations</h2>
          <p>
            Use the product tabs to inspect Interview, Study, and DPE without leaving
            the protected admin area.
          </p>
        </div>
      </div>
      <div className="prompt-version-list">
        <Link className="button-link secondary" href="/admin?product=interview">
          Interview admin
        </Link>
        <Link className="button-link secondary" href="/admin?product=study">
          Study admin
        </Link>
        <Link className="button-link secondary" href="/admin?product=dpe">
          DPE admin
        </Link>
      </div>
    </section>
  );
}

async function StudyAdminPanel() {
  let decks: Awaited<ReturnType<typeof getStudyLibraryDecks>> = [];
  let unavailable = false;

  try {
    decks = await getStudyLibraryDecks();
  } catch (error) {
    unavailable = true;
    console.error("Study admin deck summary unavailable.", error);
  }

  const officialDecks = decks.filter((deck) => deck.isOfficial).length;
  const fullyVerifiedDecks = decks.filter(
    (deck) => deck.cardCount > 0 && (deck.verifiedCardCount ?? 0) === deck.cardCount,
  ).length;
  const partiallyVerifiedDecks = decks.filter(
    (deck) =>
      (deck.verifiedCardCount ?? 0) > 0 &&
      (deck.cardCount <= 0 || (deck.verifiedCardCount ?? 0) < deck.cardCount),
  ).length;

  return (
    <section className="ai-runs-panel" aria-labelledby="study-admin-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Study</p>
          <h2 id="study-admin-title">Deck Operations</h2>
          <p>Monitor public library trust status and run deck verification from deck detail pages.</p>
        </div>
        <Link className="button-link secondary" href="/study/library">
          Open library
        </Link>
      </div>

      <div className="study-stat-strip" aria-label="Study admin summary">
        <div className="study-stat-chip">
          <strong>{unavailable ? "--" : decks.length}</strong>
          <span>Public decks</span>
        </div>
        <div className="study-stat-chip">
          <strong>{unavailable ? "--" : officialDecks}</strong>
          <span>Official</span>
        </div>
        <div className="study-stat-chip">
          <strong>{unavailable ? "--" : fullyVerifiedDecks}</strong>
          <span>Verified</span>
        </div>
        <div className="study-stat-chip">
          <strong>{unavailable ? "--" : partiallyVerifiedDecks}</strong>
          <span>Partial</span>
        </div>
      </div>

      <div className="prompt-version-list">
        <h3>Verification</h3>
        <p>
          V1 verification is admin-triggered from a deck page. The AI review marks
          individual cards verified only when the confidence threshold is met, then
          updates the deck verified-card count.
        </p>
        <Link className="button-link" href="/study/library?verified=1">
          View verified decks
        </Link>
      </div>
    </section>
  );
}

async function DpeAdminPanel() {
  let summary: Awaited<ReturnType<typeof listDpeContentSummary>> = {
    available: false,
    certificateTypes: [],
  };

  try {
    summary = await listDpeContentSummary();
  } catch (error) {
    console.error("DPE admin content summary unavailable.", error);
  }

  const totalQuestions = summary.certificateTypes.reduce(
    (total, certificateType) => total + certificateType.questions.length,
    0,
  );
  const missingAnswerKeys = summary.certificateTypes.reduce(
    (total, certificateType) =>
      total +
      certificateType.questions.filter((question) => question.answerKeyStatus === "missing")
        .length,
    0,
  );
  const missingRubrics = summary.certificateTypes.reduce(
    (total, certificateType) =>
      total +
      certificateType.questions.filter((question) => question.rubricStatus === "missing").length,
    0,
  );

  return (
    <section className="ai-runs-panel" aria-labelledby="dpe-admin-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">DPE</p>
          <h2 id="dpe-admin-title">Content and Practice Readiness</h2>
          <p>Inspect seeded certificate content, oral questions, answer keys, and rubric gaps.</p>
        </div>
        <Link className="button-link secondary" href="/dpe">
          Open DPE
        </Link>
      </div>

      <div className="study-stat-strip" aria-label="DPE admin summary">
        <div className="study-stat-chip">
          <strong>{summary.available ? "Online" : "Offline"}</strong>
          <span>Database</span>
        </div>
        <div className="study-stat-chip">
          <strong>{summary.certificateTypes.length}</strong>
          <span>Certificates</span>
        </div>
        <div className="study-stat-chip">
          <strong>{totalQuestions}</strong>
          <span>Questions</span>
        </div>
        <div className="study-stat-chip">
          <strong>{missingAnswerKeys + missingRubrics}</strong>
          <span>Gaps</span>
        </div>
      </div>

      <div className="prompt-version-list">
        {summary.certificateTypes.length > 0 ? (
          summary.certificateTypes.map((certificateType) => (
            <article className="raised-card" key={certificateType.id}>
              <div className="question-meta">
                <span className="pill">{certificateType.code}</span>
                <span className="pill">{certificateType.active ? "active" : "inactive"}</span>
                <span className="pill">{certificateType.questions.length} questions</span>
              </div>
              <strong>{certificateType.title}</strong>
              <p>
                {certificateType.category ?? "Category pending"} /{" "}
                {certificateType.aircraftClass ?? "Class pending"}
              </p>
            </article>
          ))
        ) : (
          <p>
            {summary.available
              ? "The DPE tables are reachable, but no certificate content is seeded yet."
              : "DPE content storage is not reachable. Learners will see fallback prompts where possible."}
          </p>
        )}
      </div>
    </section>
  );
}
