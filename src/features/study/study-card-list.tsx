"use client";

import { useState, type FormEvent } from "react";

type StudyCard = {
  answer: string;
  hint: string | null;
  id: string;
  isVerified?: boolean;
  position: number;
  question: string;
};

type EditingCardState = {
  answer: string;
  hint: string;
  question: string;
};

type StudyCardListProps = {
  deckId: string;
  initialCards: StudyCard[];
  isOwner: boolean;
};

export function StudyCardList({ deckId, initialCards, isOwner }: StudyCardListProps) {
  const [addingCard, setAddingCard] = useState(false);
  const [addError, setAddError] = useState<string>();
  const [answer, setAnswer] = useState("");
  const [cards, setCards] = useState(initialCards);
  const [hint, setHint] = useState("");
  const [pending, setPending] = useState(false);
  const [question, setQuestion] = useState("");
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<EditingCardState>({
    answer: "",
    hint: "",
    question: "",
  });
  const [editPending, setEditPending] = useState(false);
  const [editError, setEditError] = useState<string>();
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!question.trim() || !answer.trim()) {
      setAddError("Question and answer are required.");
      return;
    }

    setPending(true);
    setAddError(undefined);

    const response = await fetch(`/api/study/decks/${deckId}/cards`, {
      body: JSON.stringify({
        answer: answer.trim(),
        hint: hint.trim() || undefined,
        question: question.trim(),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = (await response.json()) as { card?: StudyCard; error?: string };

    setPending(false);

    if (!response.ok || !data.card) {
      setAddError(data.error ?? "Card could not be added.");
      return;
    }

    setCards((current) => [...current, data.card as StudyCard]);
    setQuestion("");
    setAnswer("");
    setHint("");
    setAddingCard(false);
  }

  async function handleDelete(cardId: string) {
    if (!confirm("Delete this card?")) {
      return;
    }
    setDeletingCardId(cardId);
    await fetch(`/api/study/decks/${deckId}/cards/${cardId}`, { method: "DELETE" });
    setDeletingCardId(null);
    setCards((current) => current.filter((card) => card.id !== cardId));
  }

  function startEdit(card: StudyCard) {
    setEditingCardId(card.id);
    setEditError(undefined);
    setEditingValues({
      answer: card.answer,
      hint: card.hint ?? "",
      question: card.question,
    });
  }

  function cancelEdit() {
    setEditingCardId(null);
    setEditError(undefined);
    setEditingValues({
      answer: "",
      hint: "",
      question: "",
    });
  }

  async function saveEdit(cardId: string) {
    if (!editingValues.question.trim() || !editingValues.answer.trim()) {
      setEditError("Question and answer are required.");
      return;
    }
    setEditPending(true);
    setEditError(undefined);
    const response = await fetch(`/api/study/decks/${deckId}/cards/${cardId}`, {
      body: JSON.stringify({
        answer: editingValues.answer.trim(),
        hint: editingValues.hint.trim() || null,
        question: editingValues.question.trim(),
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const data = (await response.json()) as { card?: StudyCard; error?: string };
    setEditPending(false);
    if (!response.ok || !data.card) {
      setEditError(data.error ?? "Card could not be saved.");
      return;
    }
    setCards((current) =>
      current.map((item) => (item.id === cardId ? (data.card as StudyCard) : item)),
    );
    cancelEdit();
  }

  return (
    <section className="study-card-list">
      {cards.length === 0 && !addingCard && (
        <p className="card-list__empty">No cards yet. Add your first card.</p>
      )}

      {cards.map((card) => (
        <article className="study-card-item" key={card.id}>
          {editingCardId === card.id ? (
            <div className="study-card-editor">
              <label>
                <span>Question *</span>
                <textarea
                  autoFocus
                  onChange={(event) =>
                    setEditingValues((current) => ({ ...current, question: event.target.value }))
                  }
                  rows={2}
                  value={editingValues.question}
                />
              </label>
              <label>
                <span>Answer *</span>
                <textarea
                  onChange={(event) =>
                    setEditingValues((current) => ({ ...current, answer: event.target.value }))
                  }
                  rows={3}
                  value={editingValues.answer}
                />
              </label>
              <label>
                <span>Hint</span>
                <input
                  onChange={(event) =>
                    setEditingValues((current) => ({ ...current, hint: event.target.value }))
                  }
                  type="text"
                  value={editingValues.hint}
                />
              </label>
              {editError && <p className="form-error">{editError}</p>}
              <div className="inline-actions">
                <button className="secondary" disabled={editPending} onClick={cancelEdit} type="button">
                  Cancel
                </button>
                <button disabled={editPending} onClick={() => void saveEdit(card.id)} type="button">
                  {editPending ? "Saving" : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="study-card-question">{card.question}</p>
              <p>{card.answer}</p>
              {card.hint && <p className="study-card-hint">Hint: {card.hint}</p>}
            </div>
          )}
          {isOwner && (
            <div className="inline-actions">
              {editingCardId !== card.id && (
                <button className="secondary" onClick={() => startEdit(card)} type="button">
                  Edit
                </button>
              )}
              <button
                className="secondary danger"
                disabled={deletingCardId === card.id}
                onClick={() => handleDelete(card.id)}
                type="button"
              >
                {deletingCardId === card.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          )}
        </article>
      ))}

      {isOwner && (
        <>
          {addingCard ? (
            <form className="study-card-item study-card-editor" onSubmit={handleAdd}>
              <label>
                <span>Question *</span>
                <textarea
                  autoFocus
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="What do you want to test?"
                  rows={2}
                  value={question}
                />
              </label>
              <label>
                <span>Answer *</span>
                <textarea
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="The correct answer"
                  rows={3}
                  value={answer}
                />
              </label>
              <label>
                <span>Hint</span>
                <input
                  onChange={(event) => setHint(event.target.value)}
                  placeholder="Optional memory aid"
                  type="text"
                  value={hint}
                />
              </label>
              {addError && <p className="form-error">{addError}</p>}
              <div className="inline-actions">
                <button className="secondary" onClick={() => setAddingCard(false)} type="button">
                  Cancel
                </button>
                <button disabled={pending} type="submit">
                  {pending ? "Adding" : "Add Card"}
                </button>
              </div>
            </form>
          ) : (
            <button className="secondary" onClick={() => setAddingCard(true)} type="button">
              Add Card
            </button>
          )}
        </>
      )}
    </section>
  );
}
