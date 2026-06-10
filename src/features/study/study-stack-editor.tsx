"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import styles from "@/features/study/study-stacks.module.css";

type StackEditorDeck = {
  cardCount: number;
  deckId: string;
  description: string | null;
  isOfficial: boolean;
  isPublic: boolean;
  sortOrder: number;
  subject: string | null;
  title: string;
  userId: string | null;
  verifiedCardCount: number;
};

type StackDeckOption = {
  cardCount: number;
  description: string | null;
  id: string;
  isOfficial: boolean;
  isPublic: boolean;
  subject: string | null;
  title: string;
  userId: string | null;
  verifiedCardCount?: number;
};

type StudyStackEditorProps = {
  canManageOfficial: boolean;
  initialDecks: StackEditorDeck[];
  stack: {
    description: string | null;
    id: string;
    isOfficial: boolean;
    isPublic: boolean;
    subject: string | null;
    title: string;
  };
  userDecks: StackDeckOption[];
};

export function StudyStackEditor({
  canManageOfficial,
  initialDecks,
  stack,
  userDecks,
}: StudyStackEditorProps) {
  const router = useRouter();
  const [decks, setDecks] = useState(initialDecks);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState({
    description: stack.description ?? "",
    isOfficial: stack.isOfficial,
    isPublic: stack.isPublic,
    subject: stack.subject ?? "",
    title: stack.title,
  });
  const availableDecks = useMemo(() => {
    const activeDeckIds = new Set(decks.map((deck) => deck.deckId));
    return userDecks.filter((deck) => !activeDeckIds.has(deck.id));
  }, [decks, userDecks]);

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!metadata.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(undefined);
    const response = await fetch(`/api/study/stacks/${stack.id}`, {
      body: JSON.stringify({
        description: metadata.description.trim() || null,
        isOfficial: canManageOfficial ? metadata.isOfficial : undefined,
        isPublic: metadata.isPublic,
        subject: metadata.subject.trim() || null,
        title: metadata.title.trim(),
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const data = (await response.json()) as { error?: string };
    setSaving(false);

    if (!response.ok) {
      setError(data.error ?? "Stack could not be saved.");
      return;
    }

    router.refresh();
  }

  async function addDeck() {
    const deckId = selectedDeckId;
    if (!deckId) return;

    const response = await fetch(`/api/study/stacks/${stack.id}/items`, {
      body: JSON.stringify({ deckId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(data.error ?? "Deck could not be added.");
      return;
    }

    const deck = userDecks.find((item) => item.id === deckId);
    if (deck) {
      setDecks((current) => [
        ...current,
        {
          cardCount: deck.cardCount,
          deckId: deck.id,
          description: deck.description,
          isOfficial: deck.isOfficial,
          isPublic: deck.isPublic,
          sortOrder: current.length,
          subject: deck.subject,
          title: deck.title,
          userId: deck.userId,
          verifiedCardCount: deck.verifiedCardCount ?? 0,
        },
      ]);
    }
    setSelectedDeckId("");
    router.refresh();
  }

  async function persistOrder(nextDecks: StackEditorDeck[]) {
    setDecks(nextDecks.map((deck, index) => ({ ...deck, sortOrder: index })));
    const response = await fetch(`/api/study/stacks/${stack.id}/items`, {
      body: JSON.stringify({ deckIds: nextDecks.map((deck) => deck.deckId) }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    if (!response.ok) {
      setError("Deck order could not be saved.");
    }
    router.refresh();
  }

  async function moveDeck(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= decks.length) return;
    const nextDecks = [...decks];
    [nextDecks[index], nextDecks[nextIndex]] = [nextDecks[nextIndex], nextDecks[index]];
    await persistOrder(nextDecks);
  }

  async function removeDeck(deckId: string) {
    const response = await fetch(`/api/study/stacks/${stack.id}/items?deckId=${encodeURIComponent(deckId)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Deck could not be removed.");
      return;
    }
    setDecks((current) => current.filter((deck) => deck.deckId !== deckId));
    router.refresh();
  }

  async function deleteStack() {
    if (!window.confirm("Delete this stack? Decks inside it will not be deleted.")) {
      return;
    }
    const response = await fetch(`/api/study/stacks/${stack.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Stack could not be deleted.");
      return;
    }
    router.push("/study/stacks");
    router.refresh();
  }

  return (
    <section className={styles.editor} aria-label="Stack editor">
      <form className="panel study-deck-form" onSubmit={saveMetadata}>
        <div>
          <p className="eyebrow">Stack settings</p>
          <h2>Edit stack</h2>
        </div>
        <label>
          <span>Title *</span>
          <input
            onChange={(event) => setMetadata((current) => ({ ...current, title: event.target.value }))}
            type="text"
            value={metadata.title}
          />
        </label>
        <label>
          <span>Description</span>
          <textarea
            onChange={(event) => setMetadata((current) => ({ ...current, description: event.target.value }))}
            rows={3}
            value={metadata.description}
          />
        </label>
        <label>
          <span>Subject</span>
          <input
            onChange={(event) => setMetadata((current) => ({ ...current, subject: event.target.value }))}
            type="text"
            value={metadata.subject}
          />
        </label>
        <label className="study-check-label">
          <input
            checked={metadata.isPublic}
            onChange={(event) => setMetadata((current) => ({ ...current, isPublic: event.target.checked }))}
            type="checkbox"
          />
          <span>Public stack</span>
        </label>
        {canManageOfficial && (
          <label className="study-check-label">
            <input
              checked={metadata.isOfficial}
              onChange={(event) =>
                setMetadata((current) => ({ ...current, isOfficial: event.target.checked }))
              }
              type="checkbox"
            />
            <span>Official stack</span>
          </label>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="inline-actions">
          <button disabled={saving} type="submit">
            {saving ? "Saving" : "Save Stack"}
          </button>
          <button className="secondary danger" onClick={() => void deleteStack()} type="button">
            <Trash2 size={14} aria-hidden="true" />
            Delete
          </button>
        </div>
      </form>

      <section className={`panel ${styles.itemManager}`}>
        <div>
          <p className="eyebrow">Deck order</p>
          <h2>Manage decks</h2>
        </div>
        <div className={`inline-actions ${styles.addRow}`}>
          <select
            aria-label="Deck to add"
            onChange={(event) => setSelectedDeckId(event.target.value)}
            value={selectedDeckId}
          >
            <option value="">Choose a deck</option>
            {availableDecks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.title}
              </option>
            ))}
          </select>
          <button disabled={!selectedDeckId} onClick={() => void addDeck()} type="button">
            <Plus size={14} aria-hidden="true" />
            Add
          </button>
        </div>
        {decks.length === 0 ? (
          <p className={styles.muted}>Add decks to build this stack sequence.</p>
        ) : (
          <ol className={styles.list}>
            {decks.map((deck, index) => (
              <li className={styles.item} key={deck.deckId}>
                <div className={styles.meta}>
                  <strong>{deck.title}</strong>
                  <span>
                    {deck.cardCount} cards{deck.subject ? ` - ${deck.subject}` : ""}
                  </span>
                </div>
                <div className="inline-actions">
                  <button
                    aria-label={`Move ${deck.title} up`}
                    className="secondary icon-button"
                    disabled={index === 0}
                    onClick={() => void moveDeck(index, -1)}
                    type="button"
                  >
                    <ArrowUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    aria-label={`Move ${deck.title} down`}
                    className="secondary icon-button"
                    disabled={index === decks.length - 1}
                    onClick={() => void moveDeck(index, 1)}
                    type="button"
                  >
                    <ArrowDown size={14} aria-hidden="true" />
                  </button>
                  <button
                    aria-label={`Remove ${deck.title}`}
                    className="secondary danger icon-button"
                    onClick={() => void removeDeck(deck.deckId)}
                    type="button"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
