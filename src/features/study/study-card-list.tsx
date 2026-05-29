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

    await fetch(`/api/study/decks/${deckId}/cards/${cardId}`, { method: "DELETE" });
    setCards((current) => current.filter((card) => card.id !== cardId));
  }

  return (
    <section className="study-card-list">
      {cards.length === 0 && !addingCard && (
        <p className="card-list__empty">No cards yet. Add your first card.</p>
      )}

      {cards.map((card) => (
        <article className="study-card-item" key={card.id}>
          <div>
            <p className="study-card-question">{card.question}</p>
            <p>{card.answer}</p>
            {card.hint && <p className="study-card-hint">Hint: {card.hint}</p>}
          </div>
          {isOwner && (
            <button className="secondary danger" onClick={() => handleDelete(card.id)} type="button">
              Delete
            </button>
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
