import Link from "next/link";

import { ContentStudio } from "@/features/admin/content-studio";
import {
  dpeTargetTracks,
  inferDpeTargetTrackKeyFromCertificate,
} from "@/features/admin/dpe-target-tracks";
import { AdminView } from "@/components/interview/admin-view";
import { getStudyLibraryDecks } from "@/features/study/study-data";
import { listAdminDpeProgressionSnapshot } from "@/server/admin-data/dpe-progression";
import { listDpeContentSummary } from "@/server/dpe/dpe-data";

type AdminProduct = "content" | "dpe" | "interview" | "overview" | "study";

const adminProducts: { key: AdminProduct; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "content", label: "Content Studio" },
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
      {activeProduct === "content" && <ContentStudio />}
      {activeProduct === "interview" && (
        <AdminView eyebrow="Interview" title="Interview" />
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
            Use the product tabs to inspect Interview, Study, DPE, and shared content
            operations without leaving the protected admin area.
          </p>
        </div>
      </div>
      <div className="prompt-version-list">
        <Link className="button-link secondary" href="/admin?product=interview">
          Interview
        </Link>
        <Link className="button-link secondary" href="/admin?product=content">
          Content Studio
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
  let progression: Awaited<ReturnType<typeof listAdminDpeProgressionSnapshot>> | undefined;

  try {
    summary = await listDpeContentSummary();
  } catch (error) {
    console.error("DPE admin content summary unavailable.", error);
  }

  try {
    progression = await listAdminDpeProgressionSnapshot();
  } catch (error) {
    console.error("DPE admin progression summary unavailable.", error);
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
  const readiness = calculateDpeReadiness(totalQuestions, missingAnswerKeys, missingRubrics);
  const trackCoverage = buildDpeTrackCoverage(summary);
  const configuredTracks = trackCoverage.filter((track) => track.status !== "not_configured").length;
  const tracksWithoutContent = trackCoverage.filter(
    (track) => track.status === "configured_no_content",
  ).length;
  const tracksNeedingWork = trackCoverage.filter(
    (track) => track.status === "needs_content_work",
  ).length;
  const tracksReady = trackCoverage.filter((track) => track.status === "review_ready").length;

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
        <div className="study-stat-chip">
          <strong>{readiness}%</strong>
          <span>Ready</span>
        </div>
      </div>

      <div className="prompt-version-list">
        <article className="raised-card">
          <div className="section-head">
            <div>
              <strong>DPE progression visibility</strong>
              <p>
                Read-only Admin view of DPE progression users, XP/quest events, and rule
                definitions for MVP operational tracking.
              </p>
            </div>
          </div>
          {progression ? (
            <>
              <div className="study-stat-strip" aria-label="DPE progression totals">
                <div className="study-stat-chip">
                  <strong>{progression.totals.progressionUsers}</strong>
                  <span>Progression users</span>
                </div>
                <div className="study-stat-chip">
                  <strong>{progression.totals.totalEvents}</strong>
                  <span>XP/quest events</span>
                </div>
                <div className="study-stat-chip">
                  <strong>
                    {progression.totals.enabledQuests}/{progression.totals.totalQuests}
                  </strong>
                  <span>Enabled quests</span>
                </div>
                <div className="study-stat-chip">
                  <strong>
                    {progression.totals.activeXpRules}/{progression.totals.totalXpRules}
                  </strong>
                  <span>Active XP rules</span>
                </div>
                <div className="study-stat-chip">
                  <strong>{progression.totals.completedQuestEntries}</strong>
                  <span>Completed quest entries</span>
                </div>
              </div>

              <div className="question-list mt-4">
                <article className="raised-card">
                  <strong>Recent progression users</strong>
                  {progression.users.length > 0 ? (
                    <div className="question-list mt-4">
                      {progression.users.slice(0, 8).map((user) => (
                        <div className="raised-card" key={user.userId}>
                          <div className="question-meta">
                            <span className="pill">{user.userEmail ?? user.userId}</span>
                            <span className="pill">L{user.level}</span>
                            <span className="pill">{user.totalXp} XP</span>
                            <span className="pill">{user.reviewedSessions} reviewed</span>
                            <span className="pill">{user.completedSessions} completed</span>
                            <span className="pill">{user.streakDays} day streak</span>
                          </div>
                          <p>Updated: {formatDate(user.updatedAt)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No DPE progression users yet.</p>
                  )}
                </article>

                <article className="raised-card">
                  <strong>Recent XP and quest events</strong>
                  {progression.events.length > 0 ? (
                    <div className="question-list mt-4">
                      {progression.events.slice(0, 12).map((event) => (
                        <div className="raised-card" key={event.id}>
                          <div className="question-meta">
                            <span className="pill">{event.eventType}</span>
                            <span className="pill">{event.xp} XP</span>
                            <span className="pill">{event.userEmail ?? event.userId}</span>
                            {event.sourceEventType && (
                              <span className="pill">source {event.sourceEventType}</span>
                            )}
                            {event.ruleKey && <span className="pill">rule {event.ruleKey}</span>}
                            {event.questKey && <span className="pill">quest {event.questKey}</span>}
                          </div>
                          <p>{event.label ?? "Progression event"}</p>
                          <p>Occurred: {formatDate(event.occurredAt)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No DPE progression events yet.</p>
                  )}
                </article>

                <article className="raised-card">
                  <strong>DPE quest definitions</strong>
                  {progression.quests.length > 0 ? (
                    <div className="question-list mt-4">
                      {progression.quests.map((quest) => (
                        <div className="raised-card" key={quest.key}>
                          <div className="question-meta">
                            <span className="pill">{quest.key}</span>
                            <span className="pill">{quest.enabled ? "enabled" : "disabled"}</span>
                            <span className="pill">{quest.checkType}</span>
                            <span className="pill">threshold {quest.checkThreshold}</span>
                            <span className="pill">{quest.xpReward} XP</span>
                          </div>
                          <p>{quest.title}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No DPE quests configured yet.</p>
                  )}
                </article>

                <article className="raised-card">
                  <strong>DPE XP rule definitions</strong>
                  {progression.xpRules.length > 0 ? (
                    <div className="question-list mt-4">
                      {progression.xpRules.map((rule) => (
                        <div className="raised-card" key={rule.key}>
                          <div className="question-meta">
                            <span className="pill">{rule.key}</span>
                            <span className="pill">{rule.active ? "active" : "disabled"}</span>
                            <span className="pill">{rule.eventType}</span>
                            <span className="pill">{rule.conditionType}</span>
                            <span className="pill">{rule.awardMode}</span>
                            <span className="pill">{rule.xp} XP</span>
                          </div>
                          <p>{rule.label}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No DPE XP rules configured yet.</p>
                  )}
                </article>
              </div>
            </>
          ) : (
            <p>DPE progression storage is unreachable for Admin right now.</p>
          )}
        </article>

        <article className="raised-card">
          <div className="section-head">
            <div>
              <strong>MVP target track coverage</strong>
              <p>
                Instrument, Commercial, CFI, CFII, Multi, and MEI are tracked here so
                coverage gaps are visible before content curation is finalized.
              </p>
            </div>
          </div>
          <div className="study-stat-strip" aria-label="DPE track coverage summary">
            <div className="study-stat-chip">
              <strong>{configuredTracks}/{dpeTargetTracks.length}</strong>
              <span>Configured tracks</span>
            </div>
            <div className="study-stat-chip">
              <strong>{tracksWithoutContent}</strong>
              <span>No content yet</span>
            </div>
            <div className="study-stat-chip">
              <strong>{tracksNeedingWork}</strong>
              <span>Needs key/rubric work</span>
            </div>
            <div className="study-stat-chip">
              <strong>{tracksReady}</strong>
              <span>Review-ready tracks</span>
            </div>
          </div>
          <div className="question-list mt-4">
            {trackCoverage.map((track) => (
              <article className="raised-card" key={track.key}>
                <div className="section-head">
                  <div>
                    <strong>{track.label}</strong>
                    <p>{track.message}</p>
                  </div>
                  <span className="pill">{track.statusLabel}</span>
                </div>
                <div className="question-meta">
                  <span className="pill">{track.certificateCount} certificates</span>
                  <span className="pill">{track.questionCount} questions</span>
                  <span className="pill">{track.missingAnswerKeys} key gaps</span>
                  <span className="pill">{track.missingRubrics} rubric gaps</span>
                  <span className="pill">{track.readiness}% ready</span>
                </div>
              </article>
            ))}
          </div>
        </article>

        {summary.certificateTypes.length > 0 ? (
          summary.certificateTypes.map((certificateType) => {
            const certificateGaps = getDpeCertificateGapSummary(certificateType);
            const taskGroups = groupDpeContentByTask(certificateType);

            return (
              <article className="raised-card" key={certificateType.id}>
                <div className="question-meta">
                  <span className="pill">{certificateType.code}</span>
                  <span className="pill">{certificateType.active ? "active" : "inactive"}</span>
                  <span className="pill">{certificateType.questions.length} questions</span>
                  <span className="pill">{certificateGaps.readiness}% ready</span>
                  <span className="pill">{certificateGaps.status}</span>
                </div>
                <strong>{certificateType.title}</strong>
                <p>
                  {certificateType.category ?? "Category pending"} /{" "}
                  {certificateType.aircraftClass ?? "Class pending"}
                </p>

                <div className="study-stat-strip" aria-label={`${certificateType.title} readiness`}>
                  <div className="study-stat-chip">
                    <strong>{certificateGaps.missingAnswerKeys}</strong>
                    <span>Missing keys</span>
                  </div>
                  <div className="study-stat-chip">
                    <strong>{certificateGaps.missingRubrics}</strong>
                    <span>Missing rubrics</span>
                  </div>
                  <div className="study-stat-chip">
                    <strong>{certificateGaps.readyQuestions}</strong>
                    <span>Ready questions</span>
                  </div>
                </div>

                <div className="raised-card">
                  <strong>Controlled creation workflow</strong>
                  <div className="question-meta">
                    {getDpePipelineStages(certificateGaps).map((stage) => (
                      <span className="pill" key={stage.label}>
                        {stage.label}: {stage.status}
                      </span>
                    ))}
                  </div>
                  <p>{getDpeCertificateNextAction(certificateGaps)}</p>
                </div>

                <div className="question-list mt-4">
                  {taskGroups.map((group) => (
                    <article className="raised-card" key={group.key}>
                      <div className="section-head">
                        <div>
                          <strong>
                            Area {group.acsArea}, Task {group.acsTask}
                          </strong>
                          <p>
                            {group.questions} question{group.questions === 1 ? "" : "s"} -{" "}
                            {group.readiness}% ready
                          </p>
                        </div>
                        <span className="pill">
                          {group.gapCount > 0 ? `${group.gapCount} gaps` : "ready"}
                        </span>
                      </div>
                      <div className="question-meta">
                        <span className="pill">certificate selected</span>
                        <span className="pill">ACS task selected</span>
                        <span className="pill">{group.questions} oral questions</span>
                        <span className="pill">{group.missingAnswerKeys} key gaps</span>
                        <span className="pill">{group.missingRubrics} rubric gaps</span>
                        <span className="pill">{group.readiness}% ready</span>
                      </div>
                      {group.gapQuestions.length > 0 ? (
                        <div className="question-list mt-4">
                          {group.gapQuestions.map((question) => (
                            <div className="raised-card" key={question.id}>
                              <div className="question-meta">
                                <span className="pill">{question.id}</span>
                                <span className="pill">{question.acsElementReference}</span>
                                {question.answerKeyStatus === "missing" && (
                                  <span className="pill">missing answer key</span>
                                )}
                                {question.rubricStatus === "missing" && (
                                  <span className="pill">missing rubric</span>
                                )}
                              </div>
                              <p>{question.questionText}</p>
                              <div className="raised-card">
                                <strong>Creation pipeline</strong>
                                <div className="question-meta">
                                  {getDpeQuestionPipelineStages(question).map((stage) => (
                                    <span className="pill" key={stage.label}>
                                      {stage.label}: {stage.status}
                                    </span>
                                  ))}
                                </div>
                                <p>{getDpeQuestionNextAction(question)}</p>
                                <button disabled type="button">
                                  Editing endpoint pending
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p>No answer key or rubric gaps in this ACS task.</p>
                      )}
                    </article>
                  ))}
                </div>
              </article>
            );
          })
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

type DpeContentSummary = Awaited<ReturnType<typeof listDpeContentSummary>>;
type DpeCertificateSummary = DpeContentSummary["certificateTypes"][number];
type DpeQuestionSummary = DpeCertificateSummary["questions"][number];

function calculateDpeReadiness(
  questions: number,
  missingAnswerKeys: number,
  missingRubrics: number,
) {
  const requiredPieces = questions * 2;

  if (requiredPieces === 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(((requiredPieces - missingAnswerKeys - missingRubrics) / requiredPieces) * 100),
  );
}

function getDpeCertificateGapSummary(certificateType: DpeCertificateSummary) {
  const missingAnswerKeys = certificateType.questions.filter(
    (question) => question.answerKeyStatus === "missing",
  ).length;
  const missingRubrics = certificateType.questions.filter(
    (question) => question.rubricStatus === "missing",
  ).length;
  const readyQuestions = certificateType.questions.filter(
    (question) =>
      question.answerKeyStatus !== "missing" && question.rubricStatus !== "missing",
  ).length;
  const readiness = calculateDpeReadiness(
    certificateType.questions.length,
    missingAnswerKeys,
    missingRubrics,
  );

  return {
    missingAnswerKeys,
    missingRubrics,
    readiness,
    readyQuestions,
    status:
      missingAnswerKeys + missingRubrics === 0
        ? "ready"
        : missingAnswerKeys >= missingRubrics
          ? "needs answer keys"
          : "needs rubrics",
  };
}

function getDpePipelineStages(certificateGaps: ReturnType<typeof getDpeCertificateGapSummary>) {
  return [
    { label: "Certificate", status: "selected" },
    { label: "ACS area/task", status: "grouped" },
    { label: "Oral question", status: certificateGaps.readyQuestions > 0 ? "present" : "needs review" },
    {
      label: "Answer key",
      status: certificateGaps.missingAnswerKeys > 0 ? "gaps" : "complete",
    },
    { label: "Rubric", status: certificateGaps.missingRubrics > 0 ? "gaps" : "complete" },
    { label: "Readiness", status: `${certificateGaps.readiness}%` },
  ];
}

function getDpeCertificateNextAction(certificateGaps: ReturnType<typeof getDpeCertificateGapSummary>) {
  if (certificateGaps.missingAnswerKeys > 0) {
    return "Next controlled action: author missing answer keys before rubric expansion.";
  }

  if (certificateGaps.missingRubrics > 0) {
    return "Next controlled action: add rubrics for questions with completed answer keys.";
  }

  return "Next controlled action: review ready content for ACS coverage and certificate publishing.";
}

function getDpeQuestionPipelineStages(question: DpeQuestionSummary) {
  return [
    { label: "Oral question", status: question.questionText ? "present" : "missing" },
    {
      label: "Answer key",
      status: question.answerKeyStatus === "missing" ? "needed" : question.answerKeyStatus,
    },
    {
      label: "Rubric",
      status: question.rubricStatus === "missing" ? "needed" : question.rubricStatus,
    },
    {
      label: "Readiness",
      status:
        question.answerKeyStatus !== "missing" && question.rubricStatus !== "missing"
          ? "ready"
          : "not ready",
    },
  ];
}

function getDpeQuestionNextAction(question: DpeQuestionSummary) {
  if (question.answerKeyStatus === "missing") {
    return "Next controlled action: create an answer key with expected elements, acceptable variations, common misses, and source references.";
  }

  if (question.rubricStatus === "missing") {
    return "Next controlled action: create a rubric for knowledge, risk management, scenario judgment, communication, and readiness.";
  }

  return "Next controlled action: review this question for ACS fit and keep it ready for practice.";
}

function groupDpeContentByTask(certificateType: DpeCertificateSummary) {
  const groups = certificateType.questions.reduce<
    Record<
      string,
      {
        acsArea: string;
        acsTask: string;
        gapQuestions: DpeQuestionSummary[];
        key: string;
        missingAnswerKeys: number;
        missingRubrics: number;
        questions: number;
      }
    >
  >((accumulator, question) => {
    const key = `${question.acsArea}.${question.acsTask}`;
    accumulator[key] ??= {
      acsArea: question.acsArea,
      acsTask: question.acsTask,
      gapQuestions: [],
      key,
      missingAnswerKeys: 0,
      missingRubrics: 0,
      questions: 0,
    };

    accumulator[key].questions += 1;

    if (question.answerKeyStatus === "missing") {
      accumulator[key].missingAnswerKeys += 1;
    }

    if (question.rubricStatus === "missing") {
      accumulator[key].missingRubrics += 1;
    }

    if (question.answerKeyStatus === "missing" || question.rubricStatus === "missing") {
      accumulator[key].gapQuestions.push(question);
    }

    return accumulator;
  }, {});

  return Object.values(groups)
    .map((group) => ({
      ...group,
      gapCount: group.missingAnswerKeys + group.missingRubrics,
      readiness: calculateDpeReadiness(
        group.questions,
        group.missingAnswerKeys,
        group.missingRubrics,
      ),
    }))
    .sort(
      (left, right) =>
        right.gapCount - left.gapCount ||
        left.acsArea.localeCompare(right.acsArea, undefined, { numeric: true }) ||
        left.acsTask.localeCompare(right.acsTask, undefined, { numeric: true }),
    );
}

function formatDate(value?: string) {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

type DpeTrackCoverageStatus =
  | "configured_no_content"
  | "needs_content_work"
  | "not_configured"
  | "review_ready";

type DpeTrackCoverage = {
  certificateCount: number;
  key: string;
  label: string;
  message: string;
  missingAnswerKeys: number;
  missingRubrics: number;
  questionCount: number;
  readiness: number;
  status: DpeTrackCoverageStatus;
  statusLabel: string;
};

function buildDpeTrackCoverage(summary: DpeContentSummary): DpeTrackCoverage[] {
  return dpeTargetTracks.map((track) => {
    const certificates = summary.certificateTypes.filter((certificateType) => {
      const trackKey = inferDpeTargetTrackKeyFromCertificate({
        code: certificateType.code,
        id: certificateType.id,
        title: certificateType.title,
      });
      return trackKey === track.key;
    });
    const questionCount = certificates.reduce(
      (total, certificateType) => total + certificateType.questions.length,
      0,
    );
    const missingAnswerKeys = certificates.reduce(
      (total, certificateType) =>
        total +
        certificateType.questions.filter((question) => question.answerKeyStatus === "missing")
          .length,
      0,
    );
    const missingRubrics = certificates.reduce(
      (total, certificateType) =>
        total +
        certificateType.questions.filter((question) => question.rubricStatus === "missing").length,
      0,
    );
    const readiness = calculateDpeReadiness(questionCount, missingAnswerKeys, missingRubrics);

    if (certificates.length === 0) {
      return {
        certificateCount: 0,
        key: track.key,
        label: track.label,
        message:
          "No certificate is configured yet for this track. Add the certificate record when ready.",
        missingAnswerKeys: 0,
        missingRubrics: 0,
        questionCount: 0,
        readiness: 0,
        status: "not_configured",
        statusLabel: "Not configured yet",
      };
    }

    if (questionCount === 0) {
      return {
        certificateCount: certificates.length,
        key: track.key,
        label: track.label,
        message:
          "Certificate is configured. Content drafting and curation are still pending for this track.",
        missingAnswerKeys: 0,
        missingRubrics: 0,
        questionCount: 0,
        readiness: 0,
        status: "configured_no_content",
        statusLabel: "Configured, no content yet",
      };
    }

    if (missingAnswerKeys + missingRubrics > 0) {
      return {
        certificateCount: certificates.length,
        key: track.key,
        label: track.label,
        message:
          "Questions exist, but answer key or rubric gaps remain before review-ready status.",
        missingAnswerKeys,
        missingRubrics,
        questionCount,
        readiness,
        status: "needs_content_work",
        statusLabel: "Needs key/rubric work",
      };
    }

    return {
      certificateCount: certificates.length,
      key: track.key,
      label: track.label,
      message: "Track has question, answer key, and rubric coverage ready for admin review.",
      missingAnswerKeys: 0,
      missingRubrics: 0,
      questionCount,
      readiness,
      status: "review_ready",
      statusLabel: "Review ready",
    };
  });
}
