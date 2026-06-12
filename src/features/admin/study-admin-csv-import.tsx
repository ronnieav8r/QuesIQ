"use client";

import { CheckCircle2, ClipboardList, FileSpreadsheet, Layers3 } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type StudyImportField =
  | "externalId"
  | "deckTitle"
  | "deckDescription"
  | "industry"
  | "role"
  | "certification"
  | "examOrStandard"
  | "version"
  | "subject"
  | "topic"
  | "audience"
  | "question"
  | "answer"
  | "explanation"
  | "hint"
  | "level"
  | "tags"
  | "sourcePackId"
  | "sourcePackTitle"
  | "sourceChunkIds"
  | "sourcePages"
  | "sourceVisualAssetIds"
  | "sourceLabel"
  | "sourceUrl"
  | "additionalReferenceLabels"
  | "additionalReferenceUrls"
  | "referenceNote"
  | "sourceNotes"
  | "draftId"
  | "draftConfidence"
  | "draftWarnings"
  | "expertReviewStatus"
  | "expertReviewType"
  | "expertReviewer"
  | "expertReviewDate"
  | "expertReviewNotes"
  | "verificationStatus"
  | "verificationConfidence"
  | "verificationNotes"
  | "verificationEvidence"
  | "verifier"
  | "isOfficial"
  | "isVerified";

type StudyDeckOption = {
  cardCount: number;
  id: string;
  isOfficial: boolean;
  isPublic: boolean;
  subject: string | null;
  title: string;
  verifiedCardCount: number;
};

type StudyStackOption = {
  cardCount: number;
  deckCount: number;
  id: string;
  isOfficial: boolean;
  isPublic: boolean;
  subject: string | null;
  title: string;
};

type ParseIssue = {
  message: string;
  row: number;
  severity: "error" | "warning";
};

type PreviewRow = {
  answer: string;
  deckTitle?: string;
  expertReview: {
    date?: string;
    notes?: string;
    reviewer?: string;
    status?: string;
    type?: string;
  };
  explanation?: string;
  isOfficial?: boolean;
  question: string;
  source?: {
    sourceLabel?: string;
    sourceUrl?: string;
  };
  subject?: string;
  tags: string[];
  verification: {
    confidence?: number;
    status?: string;
    verifier?: string;
  };
};

type PreviewResponse = {
  csvHeaders: StudyImportField[];
  detectedHeaders: string[];
  effectiveMapping: Record<StudyImportField, string>;
  error?: string;
  richCsvImportSaved?: boolean;
  rowCount: number;
  rows: PreviewRow[];
  saveResult?: {
    createdCardCount: number;
    createdSourceCount: number;
    createdVerificationCount: number;
    deckId: string;
    verifiedCardCount: number;
  };
  stackResult?: { attached: boolean; created?: boolean; error?: string; stackId?: string };
  supportedTargetFields: StudyImportField[];
  validationErrors: ParseIssue[];
  validationWarnings: ParseIssue[];
  expertReviewStatusCounts: Record<string, number>;
  verificationStatusCounts: Record<string, number>;
};

type Props = {
  decks: StudyDeckOption[];
  headers: StudyImportField[];
  sampleCsv: string;
  stacks: StudyStackOption[];
};

const requiredFields = new Set<StudyImportField>(["question", "answer"]);

function detectHeaders(csvText: string) {
  const firstLine = csvText.trim().split(/\r?\n/, 1)[0] ?? "";
  if (!firstLine) return [];
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const headers: string[] = [];
  let current = "";
  let inQuote = false;
  for (let index = 0; index < firstLine.length; index += 1) {
    const char = firstLine[index];
    if (char === "\"") {
      inQuote = !inQuote;
    } else if (char === delimiter && !inQuote) {
      headers.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  headers.push(current.trim().replace(/^"|"$/g, ""));
  return headers.filter(Boolean);
}

function fieldHelp(field: StudyImportField) {
  const help: Partial<Record<StudyImportField, string>> = {
    additionalReferenceLabels: "Supporting learner-visible source labels, pipe-separated.",
    additionalReferenceUrls: "Supporting learner-visible source URLs, pipe-separated.",
    answer: "Required. Back of the card.",
    certification: "Credential or course, such as Private Pilot or NCLEX-PN.",
    examOrStandard: "Exam, standard, ACS, test plan, or framework.",
    expertReviewDate: "ISO date for human/expert review, such as 2026-06-12.",
    expertReviewer: "Human reviewer name, credential, or reviewer identifier.",
    expertReviewNotes: "Human reviewer notes, scope, or signoff comments.",
    expertReviewStatus: "not_required, needs_expert_review, expert_reviewed, or rejected.",
    expertReviewType: "Review lane, such as clinical, flight_instructor, broker, legal, or finance.",
    explanation: "Expanded learner-facing explanation shown after the short answer.",
    hint: "Optional learner hint.",
    industry: "Broad field, such as Aviation, Healthcare, Real Estate, or IT.",
    isOfficial: "Marks the imported deck Official when true.",
    isVerified: "Source/fact Verified only. This is separate from expert review and still requires verification policy.",
    question: "Required. Front of the card.",
    referenceNote: "Learner-visible note about what the official source supports.",
    role: "Learner role, such as Pilot, Nurse, or Texas Real Estate Sales Agent.",
    sourceLabel: "Citation or source name shown in admin/source metadata.",
    sourcePages: "Use 12|13 or 18-19.",
    sourceUrl: "Source URL for audit trail.",
    tags: "Use weather|metar or comma/semicolon lists.",
    topic: "Specific topic or subtopic for the card.",
    version: "Source or standard version/date.",
    verificationConfidence: "0.0 to 1.0. Verified cards require 0.8+.",
    verificationEvidence: "Evidence notes or citations.",
    verificationStatus: "verified, needs_review, ready_for_verifier, blocked, or unverified.",
    verifier: "Required with verified status/confidence for source/fact verification.",
  };
  return help[field] ?? "Optional metadata.";
}

export function StudyAdminCsvImport({ decks, headers, sampleCsv, stacks }: Props) {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [columnMapping, setColumnMapping] = useState<Partial<Record<StudyImportField, string>>>({});
  const [targetMode, setTargetMode] = useState<"existing" | "new">("new");
  const [deckId, setDeckId] = useState("");
  const [deckTitle, setDeckTitle] = useState("");
  const [deckDescription, setDeckDescription] = useState("");
  const [deckSubject, setDeckSubject] = useState("");
  const [deckTags, setDeckTags] = useState("");
  const [markDeckOfficial, setMarkDeckOfficial] = useState(true);
  const [markDeckPublic, setMarkDeckPublic] = useState(true);
  const [stackMode, setStackMode] = useState<"existing" | "new" | "none">("none");
  const [stackId, setStackId] = useState("");
  const [stackTitle, setStackTitle] = useState("");
  const [stackDescription, setStackDescription] = useState("");
  const [stackSubject, setStackSubject] = useState("");
  const [markStackOfficial, setMarkStackOfficial] = useState(true);
  const [markStackPublic, setMarkStackPublic] = useState(true);
  const [preview, setPreview] = useState<PreviewResponse>();
  const [status, setStatus] = useState<"idle" | "previewing" | "saving" | "saved">("idle");
  const [error, setError] = useState<string>();

  const detectedHeaders = useMemo(() => {
    const previewHeaders = preview?.detectedHeaders ?? [];
    return previewHeaders.length > 0 ? previewHeaders : detectHeaders(csvText);
  }, [csvText, preview?.detectedHeaders]);
  const sampleLines = sampleCsv.split(/\r?\n/).slice(0, 3).join("\n");
  const mappedCount = headers.filter((field) => {
    const mapped = columnMapping[field]?.trim() || field;
    return detectedHeaders.some((header) => header.trim().toLowerCase() === mapped.toLowerCase());
  }).length;

  async function send(mode: "preview" | "save") {
    setStatus(mode === "preview" ? "previewing" : "saving");
    setError(undefined);
    try {
      const response = await fetch("/api/admin/study/rich-csv-import", {
        body: JSON.stringify({
          columnMapping,
          createDeckDescription: deckDescription.trim() || undefined,
          createDeckSubject: deckSubject.trim() || undefined,
          createDeckTags: deckTags.split(/[|,]/).map((tag) => tag.trim()).filter(Boolean),
          createDeckTitle: deckTitle.trim() || undefined,
          createStackDescription: stackDescription.trim() || undefined,
          createStackSubject: stackSubject.trim() || undefined,
          createStackTitle: stackTitle.trim() || undefined,
          csvText,
          deckId: targetMode === "existing" ? deckId : undefined,
          markDeckOfficial,
          markDeckPublic,
          markStackOfficial,
          markStackPublic,
          mode,
          stackId: stackMode === "existing" ? stackId : undefined,
          stackMode,
          targetMode,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as PreviewResponse;
      setPreview(body);
      if (!response.ok) {
        throw new Error(body.error || "CSV import failed.");
      }
      setStatus(mode === "save" ? "saved" : "idle");
      if (mode === "save") {
        router.refresh();
      }
    } catch (importError) {
      setStatus("idle");
      setError(importError instanceof Error ? importError.message : "CSV import failed.");
    }
  }

  return (
    <section className="panel" aria-labelledby="study-admin-csv-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Study CSV Import</p>
          <h3 id="study-admin-csv-title">Import official Study decks</h3>
          <p>
            Paste a rich CSV, confirm header mapping, mark the deck Official, and optionally add it to a stack.
          </p>
        </div>
        <FileSpreadsheet size={22} aria-hidden="true" />
      </div>

      <div className="runtime-context-panel">
        <div className="section-head">
          <div>
            <strong>Exact CSV headers</strong>
            <p>Required fields are `question` and `answer`. Source verification and expert review are separate metadata layers.</p>
          </div>
          <span className="pill">{headers.length} columns</span>
        </div>
        <pre className="prompt-preview">{headers.join(",")}</pre>
        <details>
          <summary>Show field notes and sample</summary>
          <div className="question-meta mt-4">
            {headers.map((field) => (
              <span className={requiredFields.has(field) ? "pill active" : "pill"} key={field}>
                {field}: {fieldHelp(field)}
              </span>
            ))}
          </div>
          <pre className="prompt-preview mt-4">{sampleLines}</pre>
        </details>
      </div>

      <div className="field-grid">
        <label>
          <span>Rich flashcard CSV</span>
          <textarea
            onChange={(event) => {
              setCsvText(event.target.value);
              setPreview(undefined);
            }}
            placeholder="Paste your Study rich CSV here."
            rows={10}
            value={csvText}
          />
        </label>
      </div>

      <div className="runtime-context-panel">
        <div className="section-head">
          <div>
            <strong>Header mapping</strong>
            <p>Confirm each CSV header is going to the intended Study field before saving.</p>
          </div>
          <span className="pill">{mappedCount}/{headers.length} mapped</span>
        </div>
        <div className="question-meta">
          {detectedHeaders.length > 0 ? (
            detectedHeaders.map((header) => <span className="pill" key={header}>{header}</span>)
          ) : (
            <span className="pill">No headers detected yet</span>
          )}
        </div>
        <div className="field-grid mt-4">
          {headers.map((field) => (
            <label key={field}>
              <span>{field}{requiredFields.has(field) ? " *" : ""}</span>
              <select
                onChange={(event) =>
                  setColumnMapping((current) => ({ ...current, [field]: event.target.value }))
                }
                value={columnMapping[field] ?? ""}
              >
                <option value="">Use `{field}`</option>
                {Array.from(new Set([...detectedHeaders, ...headers])).map((header) => (
                  <option key={`${field}-${header}`} value={header}>{header}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="field-grid">
        <section className="runtime-context-panel">
          <div className="section-head">
            <div>
              <strong>Deck target</strong>
              <p>Create a deck or add cards to an existing one.</p>
            </div>
            <ClipboardList size={18} aria-hidden="true" />
          </div>
          <div className="component-tabs" aria-label="Deck target mode">
            <button className={targetMode === "new" ? "active" : undefined} onClick={() => setTargetMode("new")} type="button">New deck</button>
            <button className={targetMode === "existing" ? "active" : undefined} onClick={() => setTargetMode("existing")} type="button">Existing deck</button>
          </div>
          {targetMode === "new" ? (
            <div className="field-grid mt-4">
              <label><span>Deck title</span><input onChange={(event) => setDeckTitle(event.target.value)} value={deckTitle} /></label>
              <label><span>Description</span><input onChange={(event) => setDeckDescription(event.target.value)} value={deckDescription} /></label>
              <label><span>Subject</span><input onChange={(event) => setDeckSubject(event.target.value)} value={deckSubject} /></label>
              <label><span>Tags</span><input onChange={(event) => setDeckTags(event.target.value)} placeholder="private-pilot|weather" value={deckTags} /></label>
            </div>
          ) : (
            <label className="mt-4">
              <span>Existing deck</span>
              <select onChange={(event) => setDeckId(event.target.value)} value={deckId}>
                <option value="">Choose a deck</option>
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.title} ({deck.cardCount} cards)
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="study-check-label mt-4">
            <input checked={markDeckOfficial} onChange={(event) => setMarkDeckOfficial(event.target.checked)} type="checkbox" />
            <span>Mark deck Official</span>
          </label>
          <label className="study-check-label">
            <input checked={markDeckPublic} onChange={(event) => setMarkDeckPublic(event.target.checked)} type="checkbox" />
            <span>Make deck Public</span>
          </label>
        </section>

        <section className="runtime-context-panel">
          <div className="section-head">
            <div>
              <strong>Stack assignment</strong>
              <p>Add this imported deck to a deck stack now, or skip it.</p>
            </div>
            <Layers3 size={18} aria-hidden="true" />
          </div>
          <div className="component-tabs" aria-label="Stack assignment mode">
            <button className={stackMode === "none" ? "active" : undefined} onClick={() => setStackMode("none")} type="button">No stack</button>
            <button className={stackMode === "existing" ? "active" : undefined} onClick={() => setStackMode("existing")} type="button">Existing stack</button>
            <button className={stackMode === "new" ? "active" : undefined} onClick={() => setStackMode("new")} type="button">New stack</button>
          </div>
          {stackMode === "existing" && (
            <label className="mt-4">
              <span>Existing stack</span>
              <select onChange={(event) => setStackId(event.target.value)} value={stackId}>
                <option value="">Choose a stack</option>
                {stacks.map((stack) => (
                  <option key={stack.id} value={stack.id}>
                    {stack.title} ({stack.deckCount} decks)
                  </option>
                ))}
              </select>
            </label>
          )}
          {stackMode === "new" && (
            <div className="field-grid mt-4">
              <label><span>Stack title</span><input onChange={(event) => setStackTitle(event.target.value)} value={stackTitle} /></label>
              <label><span>Description</span><input onChange={(event) => setStackDescription(event.target.value)} value={stackDescription} /></label>
              <label><span>Subject</span><input onChange={(event) => setStackSubject(event.target.value)} value={stackSubject} /></label>
              <label className="study-check-label">
                <input checked={markStackOfficial} onChange={(event) => setMarkStackOfficial(event.target.checked)} type="checkbox" />
                <span>Mark stack Official</span>
              </label>
              <label className="study-check-label">
                <input checked={markStackPublic} onChange={(event) => setMarkStackPublic(event.target.checked)} type="checkbox" />
                <span>Make stack Public</span>
              </label>
            </div>
          )}
        </section>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="inline-actions">
        <button disabled={status === "previewing" || status === "saving"} onClick={() => void send("preview")} type="button">
          {status === "previewing" ? "Previewing" : "Preview CSV"}
        </button>
        <button
          disabled={status === "previewing" || status === "saving" || !preview || preview.validationErrors.length > 0}
          onClick={() => void send("save")}
          type="button"
        >
          {status === "saving" ? "Importing" : status === "saved" ? "Imported" : "Import deck"}
        </button>
      </div>

      {preview && (
        <section className="runtime-context-panel">
          <div className="section-head">
            <div>
              <strong>{preview.richCsvImportSaved ? "Import saved" : "Preview results"}</strong>
              <p>{preview.rowCount} valid rows detected.</p>
            </div>
            {preview.richCsvImportSaved && <CheckCircle2 size={20} aria-hidden="true" />}
          </div>
          <div className="study-stat-strip">
            <div className="study-stat-chip"><strong>{preview.rowCount}</strong><span>Rows</span></div>
            <div className="study-stat-chip"><strong>{preview.validationErrors.length}</strong><span>Errors</span></div>
            <div className="study-stat-chip"><strong>{preview.validationWarnings.length}</strong><span>Warnings</span></div>
            <div className="study-stat-chip"><strong>{preview.saveResult?.createdCardCount ?? "--"}</strong><span>Saved cards</span></div>
          </div>
          {preview.validationErrors.length > 0 && (
            <div className="status-callout warning">
              <strong>Fix these before import.</strong>
              {preview.validationErrors.map((issue) => <span key={`${issue.row}-${issue.message}`}>Row {issue.row}: {issue.message}</span>)}
            </div>
          )}
          {preview.validationWarnings.length > 0 && (
            <div className="status-callout warning">
              <strong>Warnings</strong>
              {preview.validationWarnings.slice(0, 6).map((issue) => <span key={`${issue.row}-${issue.message}`}>Row {issue.row}: {issue.message}</span>)}
            </div>
          )}
          {preview.stackResult?.error && (
            <div className="status-callout warning">
              <strong>Stack assignment did not complete.</strong>
              <span>{preview.stackResult.error}</span>
            </div>
          )}
          <div className="prompt-version-list">
            {preview.rows.slice(0, 8).map((row, index) => (
              <article className="prompt-version-card" key={`${row.question}-${index}`}>
                <div>
                  <strong>{row.question}</strong>
                  <p>{row.answer}</p>
                  <p className="field-note">{row.explanation}</p>
                  <p className="field-note">
                    {row.deckTitle || "Deck title from form"} | {row.subject || "No subject"} |{" "}
                    {row.isOfficial ? "Official" : "Not official"} | {row.verification.status || "unverified"}
                    {typeof row.verification.confidence === "number" ? ` (${row.verification.confidence})` : ""}
                  </p>
                  <p className="field-note">
                    Expert review: {row.expertReview.status?.replaceAll("_", " ") || "not provided"}
                    {row.expertReview.type ? ` | ${row.expertReview.type}` : ""}
                    {row.expertReview.reviewer ? ` | ${row.expertReview.reviewer}` : ""}
                    {row.expertReview.date ? ` | ${row.expertReview.date}` : ""}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
