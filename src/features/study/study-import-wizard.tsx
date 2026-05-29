"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DraftCard = {
  answer: string;
  hint?: string;
  id: string;
  question: string;
  selected: boolean;
};

const headerTokens = new Set([
  "answer",
  "answers",
  "definition",
  "definitions",
  "front",
  "hint",
  "hints",
  "question",
  "questions",
  "term",
  "terms",
]);

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

function parseCards(raw: string): DraftCard[] {
  const cards: DraftCard[] = [];
  const seen = new Set<string>();

  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, index) => {
      const delimiter = line.includes("\t")
        ? "\t"
        : line.includes("|")
          ? "|"
          : line.includes(",")
            ? ","
            : "";
      const cells = delimiter === "," ? splitCsvLine(line) : delimiter ? line.split(delimiter) : [];
      const question = cells[0]?.trim() ?? "";
      const answer = cells[1]?.trim() ?? "";
      const hint = cells[2]?.trim();

      if (!question || !answer) {
        return;
      }

      const qToken = question.toLowerCase();
      const aToken = answer.toLowerCase();
      const looksLikeHeader =
        headerTokens.has(qToken) &&
        (headerTokens.has(aToken) || aToken === "answer");

      if (looksLikeHeader) {
        return;
      }

      const key = `${question.toLowerCase()}::${answer.toLowerCase()}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);

      cards.push({
        answer,
        hint: hint || undefined,
        id: String(index),
        question,
        selected: true,
      });
    });

  return cards;
}

export function StudyImportWizard({ deckId }: { deckId: string }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftCard[]>([]);
  const [error, setError] = useState<string>();
  const [fileName, setFileName] = useState<string>("");
  const [parsingFile, setParsingFile] = useState(false);
  const [rawText, setRawText] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedCount = useMemo(() => drafts.filter((draft) => draft.selected).length, [drafts]);

  function handleParse() {
    const parsed = parseCards(rawText);

    if (parsed.length === 0) {
      setError("No valid cards found. Use one card per line: question | answer | optional hint.");
      setDrafts([]);
      return;
    }

    setError(undefined);
    setDrafts(parsed);
  }

  async function handleFileUpload(file: File) {
    setError(undefined);
    setParsingFile(true);

    try {
      const raw = await file.text();
      const parsed = parseCards(raw);

      if (parsed.length === 0) {
        setError("No valid cards found in that file. Use question/answer columns.");
        setParsingFile(false);
        return;
      }

      setDrafts((current) => {
        const existing = current.length;
        const shifted = parsed.map((draft, index) => ({
          ...draft,
          id: `${existing + index}`,
        }));

        return [...current, ...shifted];
      });
      setRawText((current) => (current ? `${current}\n${raw}` : raw));
    } catch {
      setError("Could not read that file. Please try a CSV, TSV, or TXT file.");
    } finally {
      setParsingFile(false);
    }
  }

  async function handleSave() {
    const cards = drafts
      .filter((draft) => draft.selected)
      .map(({ answer, hint, question }) => ({ answer, hint, question }));

    if (cards.length === 0) {
      setError("Select at least one card to save.");
      return;
    }

    setSaving(true);
    setError(undefined);

    const response = await fetch(`/api/study/decks/${deckId}/cards`, {
      body: JSON.stringify({ cards }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = (await response.json()) as { cards?: unknown[]; error?: string };

    setSaving(false);

    if (!response.ok) {
      setError(data.error ?? "Cards could not be saved.");
      return;
    }

    router.push(`/study/decks/${deckId}`);
    router.refresh();
  }

  function downloadTemplate(format: "csv" | "tsv") {
    const delimiter = format === "csv" ? "," : "\t";
    const ext = format === "csv" ? "csv" : "tsv";
    const lines = [
      ["question", "answer", "hint"].join(delimiter),
      ["What is Vx?", "Best angle of climb speed", "Used to gain altitude over distance"].join(delimiter),
      ["What is Vy?", "Best rate of climb speed", "Used to gain altitude quickly"].join(delimiter),
    ];
    const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quesiq-study-template.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="study-import-wizard">
      <label>
        <span>Paste cards</span>
        <textarea
          onChange={(event) => {
            setRawText(event.target.value);
            setError(undefined);
          }}
          placeholder={"Question | Answer | Optional hint\nWhat is Vx? | Best angle of climb speed\nWhat is Vy? | Best rate of climb speed"}
          rows={10}
          value={rawText}
        />
      </label>

      <section className="panel">
        <p className="eyebrow">Upload File</p>
        <p>Import from a local file (.csv, .tsv, .txt).</p>
        <div className="inline-actions">
          <button className="secondary" onClick={() => downloadTemplate("csv")} type="button">
            Download CSV Template
          </button>
          <button className="secondary" onClick={() => downloadTemplate("tsv")} type="button">
            Download TSV Template
          </button>
        </div>
        <label>
          <span>Select file</span>
          <input
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }
              setFileName(file.name);
              handleFileUpload(file);
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
        {fileName && <p>Selected: {fileName}</p>}
      </section>

      <div className="inline-actions">
        <button className="secondary" onClick={handleParse} type="button">
          Preview Cards
        </button>
        {drafts.length > 0 && (
          <button
            className="secondary"
            onClick={() => setDrafts((current) => current.map((draft) => ({ ...draft, selected: true })))}
            type="button"
          >
            Select All
          </button>
        )}
        {drafts.length > 0 && (
          <button
            className="secondary"
            onClick={() => setDrafts((current) => current.map((draft) => ({ ...draft, selected: false })))}
            type="button"
          >
            Select None
          </button>
        )}
        {drafts.length > 0 && (
          <button disabled={saving} onClick={handleSave} type="button">
            {saving ? "Saving" : `Save ${selectedCount} Cards`}
          </button>
        )}
      </div>

      {parsingFile && <p>Reading file...</p>}

      {error && <p className="form-error">{error}</p>}

      {drafts.length > 0 && (
        <div className="study-import-preview">
          {drafts.map((draft) => (
            <label className="study-import-card" key={draft.id}>
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
              <span>
                <strong>{draft.question}</strong>
                <small>{draft.answer}</small>
              </span>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
