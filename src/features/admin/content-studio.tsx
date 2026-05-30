"use client";

import {
  CheckCircle2,
  FileText,
  History,
  Play,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { useMemo, useState } from "react";

type PipelineKey = "study_flashcards" | "dpe_content";

const pipelineOptions: {
  description: string;
  key: PipelineKey;
  label: string;
  sourceHint: string;
  targetArtifact: string;
}[] = [
  {
    description:
      "Turn source notes, outlines, or imported learning material into curated Study flashcard decks.",
    key: "study_flashcards",
    label: "Study flashcard set",
    sourceHint: "Chapter notes, study guides, CSV exports, or pasted source text.",
    targetArtifact: "Verified deck draft with terms, definitions, hints, and trust metadata.",
  },
  {
    description:
      "Prepare DPE oral-practice content with answer keys, rubrics, ACS references, and review notes.",
    key: "dpe_content",
    label: "DPE content",
    sourceHint: "ACS tasks, examiner notes, aviation references, or curated question banks.",
    targetArtifact: "Reviewed DPE question, answer key, rubric, and source-reference package.",
  },
];

const templatesByPipeline: Record<
  PipelineKey,
  {
    description: string;
    label: string;
    value: string;
  }[]
> = {
  dpe_content: [
    {
      description: "Build answer keys and rubrics from vetted ACS-aligned source material.",
      label: "ACS answer key and rubric",
      value: "acs_answer_key_rubric",
    },
    {
      description: "Find source gaps before generation starts.",
      label: "DPE source coverage audit",
      value: "dpe_source_coverage",
    },
  ],
  study_flashcards: [
    {
      description: "Create concise term and definition pairs with optional hints.",
      label: "Flashcard set generator",
      value: "flashcard_set_generator",
    },
    {
      description: "Normalize imported flashcards before verification.",
      label: "Deck cleanup and taxonomy",
      value: "deck_cleanup_taxonomy",
    },
  ],
};

const stages = [
  {
    detail: "Normalize source files or pasted text, strip noise, and keep source references.",
    label: "Scrub",
  },
  {
    detail: "Generate draft artifacts from the selected pipeline and template.",
    label: "Generate",
  },
  {
    detail: "Run a separate verification pass against source material and product rules.",
    label: "Verify",
  },
  {
    detail: "Admin reviews diffs, confidence, missing sources, and product fit.",
    label: "Review",
  },
  {
    detail: "Publish only after explicit backend controls and audit history exist.",
    label: "Publish",
  },
];

export function ContentStudio() {
  const [pipelineKey, setPipelineKey] = useState<PipelineKey>("study_flashcards");
  const [selectedTemplate, setSelectedTemplate] = useState(
    templatesByPipeline.study_flashcards[0].value,
  );

  const pipeline = useMemo(
    () => pipelineOptions.find((option) => option.key === pipelineKey) ?? pipelineOptions[0],
    [pipelineKey],
  );
  const templates = templatesByPipeline[pipelineKey];

  function handlePipelineChange(nextPipeline: PipelineKey) {
    setPipelineKey(nextPipeline);
    setSelectedTemplate(templatesByPipeline[nextPipeline][0].value);
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
            {pipelineOptions.map((option) => (
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
            <span>Draft only</span>
          </div>

          <div className="field-grid">
            <label>
              <span>Source intake</span>
              <textarea
                placeholder="Paste source text, notes, outlines, CSV rows, ACS excerpts, or source links for the admin intake queue."
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
              <p>
                {templates.find((template) => template.value === selectedTemplate)?.description}
              </p>
            </div>

            <label>
              <span>Custom instructions</span>
              <textarea
                placeholder="Add product-specific constraints, source handling notes, tone requirements, verification thresholds, or reviewer instructions."
              />
            </label>
          </div>

          <div className="component-tabs" aria-label="Content Studio actions">
            <button disabled type="button">
              <UploadCloud size={18} />
              Scrub source
            </button>
            <button disabled type="button">
              <Play size={18} />
              Generate draft
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
        </div>
      </div>

      <section className="prompt-version-list" aria-labelledby="content-stages-title">
        <div className="section-head">
          <div>
            <h3 id="content-stages-title">Stage framing</h3>
            <p>Generation creates draft content. Verification is a separate quality gate.</p>
          </div>
        </div>

        <div className="study-stat-strip" aria-label="Content Studio stages">
          {stages.map((stage, index) => (
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
            <p>Backend run records are not wired yet. This area will show source, stage, reviewer, and publish audit events.</p>
          </div>
          <History size={20} aria-hidden="true" />
        </div>

        <div className="runtime-context-panel">
          <FileText size={18} aria-hidden="true" />
          <p>No Content Studio runs yet.</p>
        </div>
      </section>
    </section>
  );
}
