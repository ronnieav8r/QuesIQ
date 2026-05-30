"use client";

import {
  AlertCircle,
  CheckCircle2,
  FileText,
  History,
  Play,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  type ContentStudioPipelineKey,
  contentStudioPipelines,
  contentStudioStages,
  contentStudioTemplatesByPipeline,
} from "@/features/admin/content-studio-config";

type StudyGeneratedFlashcardDraft = {
  answer: string;
  confidence: number;
  hint?: string;
  level: "advanced" | "beginner" | "intermediate";
  question: string;
  sourceNotes?: string;
};

type StudyGeneratedDeckDraft = {
  cards: StudyGeneratedFlashcardDraft[];
  description: string;
  generationMode: "ai" | "mock";
  generationWarnings: string[];
  promptInstructions?: string;
  sourceSummary: string;
  subject?: string;
  tags: string[];
  title: string;
};

type DpeContentStudioDraft = {
  acs: {
    area?: string;
    elementType?: string;
    reference?: string;
    task?: string;
    title?: string;
  };
  answerKey: {
    acceptableVariations: string[];
    commonMisses: string[];
    correctAnswerElements: string[];
    notes?: string;
    sourceReferences: string[];
    status: "draft";
  };
  certificate: {
    code?: string;
    id?: string;
    title?: string;
  };
  confidence: number;
  generation: {
    mode: "ai" | "fallback";
    model: string | null;
    saved: false;
  };
  oralQuestion: {
    acsElementType?: string;
    primarySubject?: string;
    questionMode: "oral";
    questionText: string;
  };
  readiness: {
    hasAcsReference: boolean;
    hasAcsTask: boolean;
    hasAnswerKey: boolean;
    hasCertificate: boolean;
    hasQuestion: boolean;
    hasRubric: boolean;
    missingFields: string[];
    readyToReview: boolean;
  };
  rubric: {
    checkrideReadiness: string;
    communication: string;
    knowledge: string;
    riskManagement: string;
    scenarioJudgment: string;
    scoringNotes?: string;
    status: "draft";
  };
  sourceSummary: string;
  warnings: string[];
};

type DpeDraftContext = {
  acs: {
    area: string;
    elementType: string;
    reference: string;
    task: string;
    title: string;
  };
  certificate: {
    code: string;
    id: string;
    title: string;
  };
};

type StudyDraftRun = {
  completedAt: string;
  draft: StudyGeneratedDeckDraft;
  id: string;
  pipelineKey: "study_flashcards";
  stage: "review";
  status: "draft_ready";
  storage: "transient_review_state";
  templateKey: string;
};

type DpeDraftRun = {
  completedAt: string;
  draft: DpeContentStudioDraft;
  id: string;
  pipelineKey: "dpe_content";
  stage: "review";
  status: "draft_ready";
  storage: "transient_review_state";
  templateKey: string;
};

type ContentStudioDraftRun = DpeDraftRun | StudyDraftRun;

type ContentStudioRunHistoryRecord = {
  cardCount?: number;
  completedAt?: string;
  confidence?: number;
  errorMessage?: string;
  generationWarnings: string[];
  id: string;
  missingFields: string[];
  model: string;
  pipelineKey: "dpe_content" | "study_flashcards";
  providerRequestId?: string;
  readyToReview?: boolean;
  startedAt: string;
  status: "failed" | "started" | "succeeded";
  storage: "ai_run_audit_only";
  templateKey?: string;
  totalTokens?: number;
  userEmail?: string;
};

type RunsResponse = {
  run?: ContentStudioDraftRun;
  runs?: ContentStudioRunHistoryRecord[];
  storage?: {
    detail: string;
    durableReviewState: boolean;
  };
  error?: string;
};

type GenerateStatus = "draft_ready" | "generating" | "idle";

const MIN_SOURCE_CHARS = 40;

const emptyDpeContext: DpeDraftContext = {
  acs: {
    area: "",
    elementType: "",
    reference: "",
    task: "",
    title: "",
  },
  certificate: {
    code: "",
    id: "",
    title: "",
  },
};

function formatDate(value?: string) {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function confidenceLabel(value: number) {
  return `${Math.round(value * 100)}% generation confidence`;
}

function pipelineHistoryLabel(pipelineKey: ContentStudioRunHistoryRecord["pipelineKey"]) {
  return pipelineKey === "dpe_content" ? "DPE content draft" : "Study flashcard draft";
}

function hasDpeCertificateContext(context: DpeDraftContext) {
  return Boolean(
    context.certificate.code.trim() ||
      context.certificate.id.trim() ||
      context.certificate.title.trim(),
  );
}

export function ContentStudio() {
  const [pipelineKey, setPipelineKey] =
    useState<ContentStudioPipelineKey>("study_flashcards");
  const [selectedTemplate, setSelectedTemplate] = useState(
    contentStudioTemplatesByPipeline.study_flashcards[0].value,
  );
  const [sourceText, setSourceText] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [dpeContext, setDpeContext] = useState<DpeDraftContext>(emptyDpeContext);
  const [status, setStatus] = useState<GenerateStatus>("idle");
  const [error, setError] = useState<string>();
  const [draftRun, setDraftRun] = useState<ContentStudioDraftRun>();
  const [runHistory, setRunHistory] = useState<ContentStudioRunHistoryRecord[]>([]);
  const [storageDetail, setStorageDetail] = useState<string>();

  const pipeline = useMemo(
    () => contentStudioPipelines.find((option) => option.key === pipelineKey) ?? contentStudioPipelines[0],
    [pipelineKey],
  );
  const templates = contentStudioTemplatesByPipeline[pipelineKey];
  const selectedTemplateDetail = templates.find(
    (template) => template.value === selectedTemplate,
  );
  const canGenerateDraft =
    status !== "generating" &&
    sourceText.trim().length >= MIN_SOURCE_CHARS &&
    (pipelineKey === "study_flashcards" || hasDpeCertificateContext(dpeContext));

  useEffect(() => {
    let cancelled = false;

    async function loadRuns() {
      try {
        const response = await fetch("/api/admin/content-studio/runs", {
          cache: "no-store",
        });
        const body = (await response.json()) as RunsResponse;

        if (cancelled) {
          return;
        }

        if (response.ok) {
          setRunHistory(body.runs ?? []);
          setStorageDetail(body.storage?.detail);
        }
      } catch {
        if (!cancelled) {
          setStorageDetail("Content Studio run history is unavailable right now.");
        }
      }
    }

    void loadRuns();

    return () => {
      cancelled = true;
    };
  }, []);

  function handlePipelineChange(nextPipeline: ContentStudioPipelineKey) {
    setPipelineKey(nextPipeline);
    setSelectedTemplate(contentStudioTemplatesByPipeline[nextPipeline][0].value);
    setError(undefined);
  }

  function updateDpeContext(
    group: keyof DpeDraftContext,
    key: string,
    value: string,
  ) {
    setDpeContext((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [key]: value,
      },
    }));
  }

  async function handleGenerateDraft() {
    if (!canGenerateDraft) {
      return;
    }

    setStatus("generating");
    setError(undefined);

    try {
      const response = await fetch("/api/admin/content-studio/runs", {
        body: JSON.stringify({
          customInstructions,
          dpeContext,
          pipelineKey,
          sourceText,
          templateKey: selectedTemplate,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as RunsResponse;

      if (!response.ok || !body.run) {
        throw new Error(body.error || "Content Studio draft generation failed.");
      }

      setDraftRun(body.run);
      setRunHistory(body.runs ?? []);
      setStorageDetail(body.storage?.detail);
      setStatus("draft_ready");
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Content Studio draft generation failed.",
      );
      setStatus("idle");
    }
  }

  return (
    <section className="ai-runs-panel" aria-labelledby="content-studio-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Shared Admin</p>
          <h2 id="content-studio-title">Content Studio</h2>
          <p>
            Stage source intake, generation, verification, review, and future publishing for
            QuesIQ content pipelines.
          </p>
        </div>
      </div>

      <div className="study-stat-strip" aria-label="Content Studio scope">
        <div className="study-stat-chip">
          <strong>2</strong>
          <span>Priority pipelines</span>
        </div>
        <div className="study-stat-chip">
          <strong>5</strong>
          <span>Controlled stages</span>
        </div>
        <div className="study-stat-chip highlight">
          <strong>Separate</strong>
          <span>Generate and verify</span>
        </div>
      </div>

      <div className="admin-layout component-admin-layout">
        <aside className="prompt-version-list" aria-label="Content pipelines">
          <section>
            <h3>Pipeline</h3>
            {contentStudioPipelines.map((option) => (
              <button
                className={pipelineKey === option.key ? "active" : undefined}
                key={option.key}
                onClick={() => handlePipelineChange(option.key)}
                type="button"
              >
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </section>

          <section>
            <h3>Target artifact</h3>
            <p>{pipeline.targetArtifact}</p>
          </section>
        </aside>

        <div className="prompt-editor">
          <div className="section-head">
            <div>
              <h2>{pipeline.label}</h2>
              <span>{pipeline.sourceHint}</span>
            </div>
            <span>Draft generation ready</span>
          </div>

          <div className="field-grid">
            <label>
              <span>Source intake</span>
              <textarea
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="Paste source text, notes, outlines, CSV rows, ACS excerpts, or source links for the admin intake queue."
                value={sourceText}
              />
            </label>

            <label>
              <span>Reusable prompt/template</span>
              <select
                onChange={(event) => setSelectedTemplate(event.target.value)}
                value={selectedTemplate}
              >
                {templates.map((template) => (
                  <option key={template.value} value={template.value}>
                    {template.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="runtime-context-panel">
              <strong>Template intent</strong>
              <p>{selectedTemplateDetail?.description}</p>
            </div>

            {pipelineKey === "dpe_content" && (
              <DpeContextFields context={dpeContext} onChange={updateDpeContext} />
            )}

            <label>
              <span>Custom instructions</span>
              <textarea
                onChange={(event) => setCustomInstructions(event.target.value)}
                placeholder="Add product-specific constraints, source handling notes, tone requirements, verification thresholds, or reviewer instructions."
                value={customInstructions}
              />
            </label>
          </div>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <div className="component-tabs" aria-label="Content Studio actions">
            <button disabled type="button">
              <UploadCloud size={18} />
              Scrub source
            </button>
            <button
              disabled={!canGenerateDraft}
              onClick={handleGenerateDraft}
              type="button"
            >
              <Play size={18} />
              {status === "generating" ? "Generating" : "Generate draft"}
            </button>
            <button disabled type="button">
              <ShieldCheck size={18} />
              Verify draft
            </button>
            <button disabled type="button">
              <CheckCircle2 size={18} />
              Publish
            </button>
          </div>

          {pipelineKey === "dpe_content" && (
            <div className="form-note">
              DPE generation returns a draft for review only. It does not write
              questions, answer keys, rubrics, Official status, or Verified state.
            </div>
          )}
        </div>
      </div>

      {draftRun && <DraftReviewPanel run={draftRun} />}

      <section className="prompt-version-list" aria-labelledby="content-stages-title">
        <div className="section-head">
          <div>
            <h3 id="content-stages-title">Stage framing</h3>
            <p>Generation creates draft content. Verification is a separate quality gate.</p>
          </div>
        </div>

        <div className="study-stat-strip" aria-label="Content Studio stages">
          {contentStudioStages.map((stage, index) => (
            <div className="study-stat-chip" key={stage.label}>
              <strong>
                {index + 1}. {stage.label}
              </strong>
              <span>{stage.detail}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="prompt-version-list" aria-labelledby="content-history-title">
        <div className="section-head">
          <div>
            <h3 id="content-history-title">Run history</h3>
            <p>
              {storageDetail ??
                "AI-backed Content Studio draft runs appear here when durable AI usage storage is available."}
            </p>
          </div>
          <History size={20} aria-hidden="true" />
        </div>

        {runHistory.length > 0 ? (
          <div className="ai-runs-list">
            {runHistory.map((run) => (
              <article className="runtime-context-panel" key={run.id}>
                <div className="section-head">
                  <div>
                    <strong>{pipelineHistoryLabel(run.pipelineKey)}</strong>
                    <p>{formatDate(run.completedAt ?? run.startedAt)}</p>
                  </div>
                  <span>{run.status}</span>
                </div>
                <div className="question-meta">
                  <span className="pill">{run.model}</span>
                  {run.pipelineKey === "study_flashcards" && (
                    <span className="pill">{run.cardCount ?? 0} cards</span>
                  )}
                  {run.pipelineKey === "dpe_content" && (
                    <>
                      <span className="pill">
                        {run.readyToReview ? "ready to review" : "needs review"}
                      </span>
                      <span className="pill">
                        {run.confidence !== undefined
                          ? confidenceLabel(run.confidence)
                          : "confidence unavailable"}
                      </span>
                      <span className="pill">{run.missingFields.length} missing fields</span>
                    </>
                  )}
                  <span className="pill">{run.totalTokens ?? 0} tokens</span>
                  <span className="pill">{run.storage.replaceAll("_", " ")}</span>
                </div>
                {run.errorMessage && <p>{run.errorMessage}</p>}
                {run.generationWarnings.length > 0 && (
                  <p>{run.generationWarnings.join(" ")}</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="runtime-context-panel">
            <FileText size={18} aria-hidden="true" />
            <p>No durable Content Studio AI runs yet.</p>
          </div>
        )}
      </section>
    </section>
  );
}

function DraftReviewPanel({ run }: { run: ContentStudioDraftRun }) {
  if (run.pipelineKey === "dpe_content") {
    return <DpeDraftReviewPanel run={run} />;
  }

  return <StudyDraftReviewPanel run={run} />;
}

function DpeContextFields({
  context,
  onChange,
}: {
  context: DpeDraftContext;
  onChange: (group: keyof DpeDraftContext, key: string, value: string) => void;
}) {
  return (
    <div className="runtime-context-panel">
      <strong>DPE context</strong>
      <p>Certificate context is required. ACS fields improve draft grounding but do not save content.</p>
      <div className="field-grid">
        <label>
          <span>Certificate title</span>
          <input
            onChange={(event) => onChange("certificate", "title", event.target.value)}
            placeholder="Private Pilot Airplane Single-Engine Land"
            value={context.certificate.title}
          />
        </label>
        <label>
          <span>Certificate code</span>
          <input
            onChange={(event) => onChange("certificate", "code", event.target.value)}
            placeholder="PPL-ASEL"
            value={context.certificate.code}
          />
        </label>
        <label>
          <span>ACS area</span>
          <input
            onChange={(event) => onChange("acs", "area", event.target.value)}
            placeholder="Area of Operation"
            value={context.acs.area}
          />
        </label>
        <label>
          <span>ACS task</span>
          <input
            onChange={(event) => onChange("acs", "task", event.target.value)}
            placeholder="Task"
            value={context.acs.task}
          />
        </label>
        <label>
          <span>ACS reference</span>
          <input
            onChange={(event) => onChange("acs", "reference", event.target.value)}
            placeholder="PA.I.A.K1"
            value={context.acs.reference}
          />
        </label>
        <label>
          <span>ACS element type</span>
          <input
            onChange={(event) => onChange("acs", "elementType", event.target.value)}
            placeholder="Knowledge, Risk Management, or Skill"
            value={context.acs.elementType}
          />
        </label>
      </div>
    </div>
  );
}

function StudyDraftReviewPanel({ run }: { run: StudyDraftRun }) {
  return (
    <section className="prompt-version-list" aria-labelledby="draft-review-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Review</p>
          <h3 id="draft-review-title">{run.draft.title}</h3>
          <p>{run.draft.description}</p>
        </div>
        <span>{run.draft.generationMode === "ai" ? "AI draft" : "Fallback draft"}</span>
      </div>

      <div className="study-stat-strip" aria-label="Draft review summary">
        <div className="study-stat-chip">
          <strong>{run.draft.cards.length}</strong>
          <span>Draft cards</span>
        </div>
        <div className="study-stat-chip">
          <strong>{run.draft.generationWarnings.length}</strong>
          <span>Warnings</span>
        </div>
        <div className="study-stat-chip highlight">
          <strong>Review</strong>
          <span>Not verified</span>
        </div>
      </div>

      <div className="runtime-context-panel">
        <strong>Source summary</strong>
        <p>{run.draft.sourceSummary}</p>
      </div>

      {run.draft.generationWarnings.length > 0 && (
        <div className="runtime-context-panel">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <strong>Generation warnings</strong>
            <ul>
              {run.draft.generationWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="question-list">
        {run.draft.cards.map((card, index) => (
          <article className="runtime-context-panel" key={`${card.question}-${index}`}>
            <div className="question-meta">
              <span className="pill">Card {index + 1}</span>
              <span className="pill">{card.level}</span>
              <span className="pill">{confidenceLabel(card.confidence)}</span>
            </div>
            <strong>{card.question}</strong>
            <p>{card.answer}</p>
            {card.hint && <p>Hint: {card.hint}</p>}
            {card.sourceNotes && <p>Source notes: {card.sourceNotes}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function DpeDraftReviewPanel({ run }: { run: DpeDraftRun }) {
  const draft = run.draft;

  return (
    <section className="prompt-version-list" aria-labelledby="dpe-draft-review-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Review</p>
          <h3 id="dpe-draft-review-title">DPE content draft</h3>
          <p>{draft.sourceSummary}</p>
        </div>
        <span>{draft.generation.mode === "ai" ? "AI draft" : "Fallback draft"}</span>
      </div>

      <div className="study-stat-strip" aria-label="DPE draft readiness summary">
        <div className="study-stat-chip">
          <strong>{draft.readiness.readyToReview ? "Ready" : "Needs work"}</strong>
          <span>Review status</span>
        </div>
        <div className="study-stat-chip">
          <strong>{Math.round(draft.confidence * 100)}%</strong>
          <span>Confidence</span>
        </div>
        <div className="study-stat-chip highlight">
          <strong>{draft.readiness.missingFields.length}</strong>
          <span>Missing fields</span>
        </div>
      </div>

      <div className="runtime-context-panel">
        <strong>Certificate</strong>
        <div className="question-meta">
          <span className="pill">{draft.certificate.title || "Title missing"}</span>
          <span className="pill">{draft.certificate.code || "Code missing"}</span>
          <span className="pill">{draft.certificate.id || "ID missing"}</span>
        </div>
      </div>

      <div className="runtime-context-panel">
        <strong>ACS</strong>
        <div className="question-meta">
          <span className="pill">Area: {draft.acs.area || "missing"}</span>
          <span className="pill">Task: {draft.acs.task || "missing"}</span>
          <span className="pill">Reference: {draft.acs.reference || "missing"}</span>
          <span className="pill">Type: {draft.acs.elementType || "missing"}</span>
        </div>
        {draft.acs.title && <p>{draft.acs.title}</p>}
      </div>

      <div className="runtime-context-panel">
        <strong>Oral question</strong>
        <p>{draft.oralQuestion.questionText || "Question text missing."}</p>
        <div className="question-meta">
          <span className="pill">{draft.oralQuestion.questionMode}</span>
          <span className="pill">
            {draft.oralQuestion.primarySubject || "Subject pending"}
          </span>
          <span className="pill">
            {draft.oralQuestion.acsElementType || "Element type pending"}
          </span>
        </div>
      </div>

      <div className="runtime-context-panel">
        <strong>Answer key</strong>
        <ReviewList title="Correct answer elements" values={draft.answerKey.correctAnswerElements} />
        <ReviewList title="Acceptable variations" values={draft.answerKey.acceptableVariations} />
        <ReviewList title="Common misses" values={draft.answerKey.commonMisses} />
        <ReviewList title="Source references" values={draft.answerKey.sourceReferences} />
        {draft.answerKey.notes && <p>Notes: {draft.answerKey.notes}</p>}
      </div>

      <div className="runtime-context-panel">
        <strong>Rubric</strong>
        <p>Knowledge: {draft.rubric.knowledge || "Missing"}</p>
        <p>Risk management: {draft.rubric.riskManagement || "Missing"}</p>
        <p>Scenario judgment: {draft.rubric.scenarioJudgment || "Missing"}</p>
        <p>Communication: {draft.rubric.communication || "Missing"}</p>
        <p>Checkride readiness: {draft.rubric.checkrideReadiness || "Missing"}</p>
        {draft.rubric.scoringNotes && <p>Scoring notes: {draft.rubric.scoringNotes}</p>}
      </div>

      <div className="runtime-context-panel">
        <strong>Reviewer indicators</strong>
        <div className="question-meta">
          <span className="pill">
            Certificate: {draft.readiness.hasCertificate ? "present" : "missing"}
          </span>
          <span className="pill">
            ACS task: {draft.readiness.hasAcsTask ? "present" : "missing"}
          </span>
          <span className="pill">
            ACS reference: {draft.readiness.hasAcsReference ? "present" : "missing"}
          </span>
          <span className="pill">
            Question: {draft.readiness.hasQuestion ? "present" : "missing"}
          </span>
          <span className="pill">
            Answer key: {draft.readiness.hasAnswerKey ? "present" : "missing"}
          </span>
          <span className="pill">
            Rubric: {draft.readiness.hasRubric ? "present" : "missing"}
          </span>
        </div>
        {draft.readiness.missingFields.length > 0 ? (
          <ReviewList title="Missing fields" values={draft.readiness.missingFields} />
        ) : (
          <p>No missing fields reported by the draft generator.</p>
        )}
      </div>

      {draft.warnings.length > 0 && (
        <div className="runtime-context-panel">
          <AlertCircle size={18} aria-hidden="true" />
          <ReviewList title="Warnings" values={draft.warnings} />
        </div>
      )}
    </section>
  );
}

function ReviewList({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <strong>{title}</strong>
      {values.length > 0 ? (
        <ul>
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <p>None provided.</p>
      )}
    </div>
  );
}
