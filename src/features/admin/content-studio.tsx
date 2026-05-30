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

type ContentStudioDraftRun = {
  completedAt: string;
  draft: StudyGeneratedDeckDraft;
  id: string;
  pipelineKey: ContentStudioPipelineKey;
  stage: "review";
  status: "draft_ready";
  storage: "transient_review_state";
  templateKey: string;
};

type ContentStudioRunHistoryRecord = {
  cardCount?: number;
  completedAt?: string;
  errorMessage?: string;
  generationWarnings: string[];
  id: string;
  model: string;
  pipelineKey: "study_flashcards";
  providerRequestId?: string;
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

export function ContentStudio() {
  const [pipelineKey, setPipelineKey] =
    useState<ContentStudioPipelineKey>("study_flashcards");
  const [selectedTemplate, setSelectedTemplate] = useState(
    contentStudioTemplatesByPipeline.study_flashcards[0].value,
  );
  const [sourceText, setSourceText] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
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
  const canGenerateStudyDraft =
    pipelineKey === "study_flashcards" &&
    status !== "generating" &&
    sourceText.trim().length >= MIN_SOURCE_CHARS;

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

  async function handleGenerateDraft() {
    if (!canGenerateStudyDraft) {
      return;
    }

    setStatus("generating");
    setError(undefined);

    try {
      const response = await fetch("/api/admin/content-studio/runs", {
        body: JSON.stringify({
          customInstructions,
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
            <span>{pipelineKey === "study_flashcards" ? "Draft generation ready" : "Coming soon"}</span>
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
              disabled={!canGenerateStudyDraft}
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
              DPE draft generation is disabled until the product-owned DPE draft primitive is available.
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
                "AI-backed Study draft runs appear here when durable AI usage storage is available."}
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
                    <strong>Study flashcard draft</strong>
                    <p>{formatDate(run.completedAt ?? run.startedAt)}</p>
                  </div>
                  <span>{run.status}</span>
                </div>
                <div className="question-meta">
                  <span className="pill">{run.model}</span>
                  <span className="pill">{run.cardCount ?? 0} cards</span>
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
