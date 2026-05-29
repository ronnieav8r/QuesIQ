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

      <div className="inline-actions">
        <button className="secondary" onClick={handleParse} type="button">
          Preview Cards
        </button>
        {drafts.length > 0 && (
          <button disabled={saving} onClick={handleSave} type="button">
            {saving ? "Saving" : `Save ${selectedCount} Cards`}
          </button>
        )}
      </div>

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
