"use client";

import { Check, ChevronLeft, ChevronRight, FileUp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type SourceType = "csv" | "file" | "text" | "url";
type Step = "done" | "parsing" | "review" | "saving" | "source";

type DraftItem = {
  answer: string;
  hint?: string;
  id: string;
  question: string;
  selected: boolean;
};

type StudyImportWizardProps = {
  deckId: string;
  deckTitle: string;
};

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuote = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuote && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuote = !inQuote;
      }
    } else if (char === "," && !inQuote) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseCsvText(raw: string, swapped = false): DraftItem[] | string {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return "No rows found in CSV.";
  }

  const isTab = lines[0].includes("\t");
  const delimiter = isTab ? "\t" : ",";

  function splitRow(line: string): string[] {
    return delimiter === "\t" ? line.split("\t").map((cell) => cell.trim()) : splitCsvLine(line);
  }

  const headerKeywords = ["answer", "back", "definition", "front", "question", "term"];
  const firstRow = splitRow(lines[0]).map((cell) => cell.toLowerCase());
  const hasHeader = firstRow.some((cell) => headerKeywords.includes(cell));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const items: DraftItem[] = [];
  for (let index = 0; index < dataLines.length; index += 1) {
    const cols = splitRow(dataLines[index]);
    const question = (swapped ? cols[1] : cols[0]) ?? "";
    const answer = (swapped ? cols[0] : cols[1]) ?? "";
    if (!question.trim() || !answer.trim()) {
      continue;
    }
    items.push({
      answer: answer.trim(),
      hint: cols[2]?.trim() || undefined,
      id: String(index),
      question: question.trim(),
      selected: true,
    });
  }

  if (items.length === 0) {
    return "Could not find term/definition pairs. Ensure at least two columns are present.";
  }
  return items;
}

export function StudyImportWizard({ deckId, deckTitle }: StudyImportWizardProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("source");
  const [sourceType, setSourceType] = useState<SourceType>("file");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [pastedUrl, setPastedUrl] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [csvSwapped, setCsvSwapped] = useState(false);
  const [focusHint, setFocusHint] = useState("");
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = drafts.filter((draft) => draft.selected).length;

  function canParse() {
    if (sourceType === "file") return Boolean(file);
    if (sourceType === "text") return pastedText.trim().length > 20;
    if (sourceType === "url") return pastedUrl.split("\n").some((line) => line.trim().startsWith("http"));
    if (sourceType === "csv") return Boolean(csvFile) || csvText.trim().length > 0;
    return false;
  }

  async function handleParse() {
    setError(null);

    if (sourceType === "csv") {
      const raw = csvFile ? await csvFile.text() : csvText;
      const result = parseCsvText(raw, csvSwapped);
      if (typeof result === "string") {
        setError(result);
        return;
      }
      setDrafts(result);
      setStep("review");
      return;
    }

    setStep("parsing");
    const form = new FormData();
    if (focusHint.trim()) form.append("focusHint", focusHint.trim());
    if (sourceType === "file" && file) {
      form.append("file", file);
    } else if (sourceType === "text") {
      form.append("text", pastedText.trim());
    } else if (sourceType === "url") {
      form.append("urls", pastedUrl.trim());
    }

    const response = await fetch(`/api/study/decks/${deckId}/import`, {
      body: form,
      method: "POST",
    });
    const data = (await response.json()) as {
      cards?: Array<{ answer: string; hint?: string; question: string }>;
      error?: string;
      failedUrls?: string[];
    };

    if (!response.ok || !data.cards) {
      setError(data.error ?? "Import failed. Please try again.");
      setStep("source");
      return;
    }

    setDrafts(
      data.cards.map((card, index) => ({
        ...card,
        id: String(index),
        selected: true,
      })),
    );
    setFailedUrls(data.failedUrls ?? []);
    setStep("review");
  }

  async function handleSave() {
    const selected = drafts.filter((draft) => draft.selected);
    if (!selected.length) return;
    setStep("saving");

    const response = await fetch(`/api/study/decks/${deckId}/cards`, {
      body: JSON.stringify({
        cards: selected.map(({ answer, hint, question }) => ({ answer, hint, question })),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = (await response.json()) as { cards?: unknown[]; error?: string };

    if (!response.ok || !data.cards) {
      setError(data.error ?? "Save failed.");
      setStep("review");
      return;
    }
    setSavedCount(data.cards.length);
    setStep("done");
    router.refresh();
  }

  function resetSource() {
    setStep("source");
    setFile(null);
    setPastedText("");
    setPastedUrl("");
    setCsvFile(null);
    setCsvText("");
    setCsvSwapped(false);
    setDrafts([]);
    setError(null);
    setFailedUrls([]);
  }

  if (step === "source") {
    return (
      <div className="study-import-wizard">
        <div className="import-tabs">
          {(["file", "text", "url", "csv"] as SourceType[]).map((type) => (
            <button
              className={`import-tab${sourceType === type ? " import-tab--active" : ""}`}
              key={type}
              onClick={() => {
                setSourceType(type);
                setError(null);
              }}
              type="button"
            >
              {type === "file" && "Upload File"}
              {type === "text" && "Paste Text"}
              {type === "url" && "Paste URL"}
              {type === "csv" && "CSV / Quizlet"}
            </button>
          ))}
        </div>

        {sourceType === "file" && (
          <div
            className={`file-drop${dragOver ? " file-drop--dragover" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragLeave={() => setDragOver(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              const dropped = event.dataTransfer.files[0];
              if (dropped) setFile(dropped);
            }}
            role="button"
            tabIndex={0}
          >
            <input
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected) setFile(selected);
              }}
              ref={fileInputRef}
              style={{ display: "none" }}
              type="file"
            />
            {file ? (
              <>
                <p className="file-drop__name">{file.name}</p>
                <p className="file-drop__hint">Click to change file</p>
              </>
            ) : (
              <>
                <p className="file-drop__icon"><FileUp aria-hidden="true" size={28} /></p>
                <p className="file-drop__label">Drop a file here, or click to browse</p>
                <p className="file-drop__hint">PDF, images, or plain text up to 10 MB</p>
              </>
            )}
          </div>
        )}

        {sourceType === "text" && (
          <div className="form-field">
            <label htmlFor="study-import-text">Paste your content</label>
            <textarea
              className="import-textarea"
              id="study-import-text"
              onChange={(event) => setPastedText(event.target.value)}
              placeholder="Paste notes, a chapter, a study guide, regulations, or any text you want turned into flashcards."
              rows={10}
              value={pastedText}
            />
            <span className="field-note">{pastedText.length} characters</span>
          </div>
        )}

        {sourceType === "url" && (
          <div className="form-field">
            <label htmlFor="study-import-urls">Web page URLs (one per line)</label>
            <textarea
              className="import-textarea"
              id="study-import-urls"
              onChange={(event) => setPastedUrl(event.target.value)}
              placeholder={"https://example.com/study-guide\nhttps://example.com/reference-page"}
              rows={6}
              value={pastedUrl}
            />
            <span className="field-note">
              {pastedUrl.split("\n").filter((line) => line.trim().startsWith("http")).length || "No"} URL
              {pastedUrl.split("\n").filter((line) => line.trim().startsWith("http")).length === 1 ? "" : "s"} detected.
            </span>
          </div>
        )}

        {sourceType === "csv" && (
          <div className="import-csv">
            <p className="field-note import-csv__hint">
              CSV/TSV is parsed locally. Quizlet, Anki, and most flashcard exports work when the first two columns are term and definition. A third column becomes a hint.
            </p>
            <div
              className={`file-drop${dragOver ? " file-drop--dragover" : ""}`}
              onClick={() => csvFileInputRef.current?.click()}
              onDragLeave={() => setDragOver(false)}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                const dropped = event.dataTransfer.files[0];
                if (dropped) {
                  setCsvFile(dropped);
                  setCsvText("");
                }
              }}
              role="button"
              tabIndex={0}
            >
              <input
                accept=".csv,.tsv,.txt"
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  if (selected) {
                    setCsvFile(selected);
                    setCsvText("");
                  }
                }}
                ref={csvFileInputRef}
                style={{ display: "none" }}
                type="file"
              />
              {csvFile ? (
                <>
                  <p className="file-drop__name">{csvFile.name}</p>
                  <p className="file-drop__hint">Click to change file</p>
                </>
              ) : (
                <>
                  <p className="file-drop__icon"><FileUp aria-hidden="true" size={28} /></p>
                  <p className="file-drop__label">Drop a CSV, TSV, or TXT file here</p>
                  <p className="file-drop__hint">First two columns become Question and Answer</p>
                </>
              )}
            </div>
            <div className="import-csv__divider">or paste directly</div>
            <div className="form-field">
              <label htmlFor="study-import-csv-text">or paste rows</label>
              <textarea
                className="import-textarea"
                disabled={Boolean(csvFile)}
                id="study-import-csv-text"
                onChange={(event) => {
                  setCsvText(event.target.value);
                  if (event.target.value.trim()) setCsvFile(null);
                }}
                placeholder={"term\tdefinition\nPhotosynthesis\tProcess plants use to convert light into energy\nMitosis\tCell division producing two identical cells"}
                rows={8}
                value={csvText}
              />
              {!csvFile && csvText.trim().length > 0 && (
                <span className="field-note">{csvText.split("\n").filter((line) => line.trim()).length} rows detected</span>
              )}
            </div>
          </div>
        )}

        {sourceType !== "csv" && (
          <div className="form-field">
            <label htmlFor="study-focus-hint">Focus hint (optional)</label>
            <input
              id="study-focus-hint"
              onChange={(event) => setFocusHint(event.target.value)}
              placeholder='e.g. "medications and dosages" or "chapter 4 vocabulary"'
              type="text"
              value={focusHint}
            />
          </div>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="inline-actions">
          <button disabled={!canParse()} onClick={() => void handleParse()} type="button">
            {sourceType === "csv" ? "Preview Cards" : "Generate Flashcards"}
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (step === "parsing") {
    return (
      <div className="study-import-wizard import-wizard--loading">
        <div className="spinner" />
        <p>Que is drafting cards for review. Nothing is saved, Official, or Verified yet.</p>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="study-import-wizard">
        {failedUrls.length > 0 && (
          <div className="form-error">
            <strong>Could not fetch {failedUrls.length} URL{failedUrls.length === 1 ? "" : "s"}:</strong>
            <ul className="compact-list">
              {failedUrls.map((url) => (
                <li key={url}>{url}</li>
              ))}
            </ul>
          </div>
        )}
        {sourceType === "csv" && (
          <div className="import-csv__swap-banner">
            <span>Column 1 to Question. Column 2 to Answer.</span>
            <button
              className="secondary"
              onClick={async () => {
                const nextSwapped = !csvSwapped;
                setCsvSwapped(nextSwapped);
                const raw = csvFile ? await csvFile.text() : csvText;
                const result = parseCsvText(raw, nextSwapped);
                if (typeof result !== "string") {
                  setDrafts(result);
                }
              }}
              type="button"
            >
              {csvSwapped ? "Undo Swap" : "Swap Columns"}
            </button>
          </div>
        )}
        <div className="import-wizard__review-header">
          <p>
            {sourceType === "csv" ? (
              <><strong>{drafts.length}</strong> cards ready. Review and edit before saving to this deck.</>
            ) : (
              <>Que found <strong>{drafts.length}</strong> flashcard pairs. Review and edit before saving to this deck.</>
            )}
          </p>
          <div className="inline-actions">
            <button className="secondary" onClick={() => setDrafts((current) => current.map((draft) => ({ ...draft, selected: true })))} type="button">Select All</button>
            <button className="secondary" onClick={() => setDrafts((current) => current.map((draft) => ({ ...draft, selected: false })))} type="button">Deselect All</button>
          </div>
        </div>
        <div className="study-import-preview">
          {drafts.map((draft) => (
            <div className={`study-import-card${draft.selected ? "" : " study-import-card--deselected"}`} key={draft.id}>
              <label>
                <input
                  checked={draft.selected}
                  onChange={(event) => {
                    setDrafts((current) =>
                      current.map((item) =>
                        item.id === draft.id ? { ...item, selected: event.target.checked } : item,
                      ),
                    );
                  }}
                  type="checkbox"
                />
              </label>
              <div className="study-import-card__fields">
                <textarea
                  onChange={(event) => {
                    setDrafts((current) =>
                      current.map((item) => (item.id === draft.id ? { ...item, question: event.target.value } : item)),
                    );
                  }}
                  rows={2}
                  value={draft.question}
                />
                <textarea
                  onChange={(event) => {
                    setDrafts((current) =>
                      current.map((item) => (item.id === draft.id ? { ...item, answer: event.target.value } : item)),
                    );
                  }}
                  rows={2}
                  value={draft.answer}
                />
                {typeof draft.hint === "string" && (
                  <input
                    onChange={(event) => {
                      setDrafts((current) =>
                        current.map((item) => (item.id === draft.id ? { ...item, hint: event.target.value } : item)),
                      );
                    }}
                    type="text"
                    value={draft.hint}
                  />
                )}
              </div>
              <button
                className="draft-card__remove btn-icon"
                onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))}
                type="button"
              >
                <X aria-hidden="true" size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="inline-actions">
          <button className="secondary" onClick={resetSource} type="button">
            <ChevronLeft aria-hidden="true" size={16} /> Back
          </button>
          <button disabled={selectedCount === 0} onClick={() => void handleSave()} type="button">
            Save {selectedCount} Card{selectedCount === 1 ? "" : "s"} to Deck
          </button>
        </div>
      </div>
    );
  }

  if (step === "saving") {
    return (
      <div className="study-import-wizard import-wizard--loading">
        <div className="spinner" />
        <p>Saving selected cards to your deck...</p>
      </div>
    );
  }

  return (
    <div className="study-import-wizard import-wizard--done">
      <p className="import-wizard__success">
        <Check aria-hidden="true" size={16} />
        {savedCount} card{savedCount === 1 ? "" : "s"} added to &quot;{deckTitle}&quot;.
      </p>
      <div className="inline-actions">
        <button className="secondary" onClick={resetSource} type="button">Import More</button>
        <button onClick={() => router.push(`/study/decks/${deckId}`)} type="button">View Deck</button>
      </div>
    </div>
  );
}
