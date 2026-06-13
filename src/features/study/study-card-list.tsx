"use client";

import { useState, type FormEvent } from "react";

import { StudyCardBack } from "@/features/study/study-card-back";
import { StudyTrustBadge } from "@/features/study/study-trust-badge";

type StudyCardSource = {
  id: string;
  sourceMetadata: Record<string, unknown> | null;
  sourceLabel: string | null;
  sourceType: string;
  sourceUrl: string | null;
};

type StudyCard = {
  answer: string;
  dueAt?: Date | null;
  easeFactor?: number | null;
  explanation: string | null;
  hint: string | null;
  id: string;
  interval?: number | null;
  isVerified?: boolean;
  lapses?: number | null;
  level?: string | null;
  position: number;
  question: string;
  sources?: StudyCardSource[];
  verifications?: Array<{
    confidence: number | null;
    evidence: string[] | null;
    id: string;
    note: string | null;
    verificationStatus: string | null;
    verifier: string | null;
    verifiedByUserId: string | null;
  }>;
};

type EditingCardState = {
  answer: string;
  explanation: string;
  hint: string;
  question: string;
};

type StudyCardListProps = {
  deckId: string;
  deckIsOfficial?: boolean;
  initialCards: StudyCard[];
  isOwner: boolean;
};

export function StudyCardList({
  deckId,
  deckIsOfficial = false,
  initialCards,
  isOwner,
}: StudyCardListProps) {
  const [addingCard, setAddingCard] = useState(false);
  const [addError, setAddError] = useState<string>();
  const [answer, setAnswer] = useState("");
  const [cards, setCards] = useState(initialCards);
  const [explanation, setExplanation] = useState("");
  const [hint, setHint] = useState("");
  const [pending, setPending] = useState(false);
  const [question, setQuestion] = useState("");
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());
  const [editingValues, setEditingValues] = useState<EditingCardState>({
    answer: "",
    explanation: "",
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
        explanation: explanation.trim() || undefined,
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
    setExplanation("");
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
      explanation: card.explanation ?? "",
      hint: card.hint ?? "",
      question: card.question,
    });
  }

  function cancelEdit() {
    setEditingCardId(null);
    setEditError(undefined);
    setEditingValues({
      answer: "",
      explanation: "",
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
        explanation: editingValues.explanation.trim() || null,
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

  function cardStatus(card: StudyCard) {
    if (!card.dueAt) return "New";
    if ((card.interval ?? 0) >= 21 && (card.lapses ?? 0) === 0) return "Mastered";
    if ((card.lapses ?? 0) > 0 || (card.easeFactor ?? 2.5) < 2) return "Weak";
    if (new Date(card.dueAt).getTime() <= nowMs) return "Ready";
    return "Learning";
  }

  function formatDue(card: StudyCard) {
    if (!card.dueAt) return "Not studied yet";
    const due = new Date(card.dueAt);
    if (due.getTime() <= nowMs) return "Ready now";
    return `Review ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(due)}`;
  }

  function formatConfidence(confidence: number | null) {
    if (typeof confidence !== "number") return "Confidence not set";
    return `${Math.round(confidence * 100)}% confidence`;
  }

  function metadataList(source: StudyCardSource, key: string) {
    const value = source.sourceMetadata?.[key];
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item)).filter(Boolean);
  }

  function expertReviewMetadata(source: StudyCardSource) {
    const value = source.sourceMetadata?.expertReview;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    const review = value as Record<string, unknown>;
    return {
      date: typeof review.date === "string" ? review.date : undefined,
      notes: typeof review.notes === "string" ? review.notes : undefined,
      reviewer: typeof review.reviewer === "string" ? review.reviewer : undefined,
      status: typeof review.status === "string" ? review.status : undefined,
      type: typeof review.type === "string" ? review.type : undefined,
    };
  }

  function cardIsExpertReviewed(card: StudyCard) {
    return (
      card.sources?.some((source) => expertReviewMetadata(source)?.status === "expert_reviewed") ??
      false
    );
  }

  return (
    <section className="study-card-list">
      {cards.length === 0 && !addingCard && (
        <p className="card-list__empty">
          {isOwner
            ? "No cards yet. Add your first card below or use Import Cards for a batch."
            : "No cards are available in this deck yet."}
        </p>
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
                <span>Explanation</span>
                <textarea
                  onChange={(event) =>
                    setEditingValues((current) => ({ ...current, explanation: event.target.value }))
                  }
                  rows={4}
                  value={editingValues.explanation}
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
              <div className="study-card-meta">
                <span className="badge">{cardStatus(card)}</span>
                {card.level && <span className="badge">{card.level}</span>}
                {card.isVerified && !deckIsOfficial && <StudyTrustBadge compact type="verified" />}
                {cardIsExpertReviewed(card) && <StudyTrustBadge compact type="expert" />}
              </div>
              <p className="study-card-question">{card.question}</p>
              <StudyCardBack
                answer={card.answer}
                explanation={card.explanation}
                sources={card.sources}
              />
              {card.hint && <p className="study-card-hint">Hint: {card.hint}</p>}
              <p className="study-card-schedule">
                {formatDue(card)}
                {typeof card.easeFactor === "number" && ` - ease ${card.easeFactor.toFixed(2)}`}
              </p>
              {isOwner && ((card.sources?.length ?? 0) > 0 || (card.verifications?.length ?? 0) > 0) && (
                <details className="study-card-hint">
                  <summary>Admin source and verification details</summary>
                  {(card.sources?.length ?? 0) > 0 && (
                    <div>
                      <strong>Source material</strong>
                      <ul>
                        {card.sources?.map((source) => (
                          <li key={source.id}>
                            {source.sourceUrl ? (
                              <a href={source.sourceUrl} rel="noreferrer" target="_blank">
                                {source.sourceLabel || source.sourceType}
                              </a>
                            ) : (
                              <span>{source.sourceLabel || source.sourceType}</span>
                            )}
                            <div className="study-card-meta">
                              {metadataList(source, "sourceChunkIds").length > 0 && (
                                <span className="badge">
                                  Chunks: {metadataList(source, "sourceChunkIds").join(", ")}
                                </span>
                              )}
                              {metadataList(source, "sourcePages").length > 0 && (
                                <span className="badge">
                                  Pages: {metadataList(source, "sourcePages").join(", ")}
                                </span>
                              )}
                              {metadataList(source, "sourceVisualAssetIds").length > 0 && (
                                <span className="badge">
                                  Visuals: {metadataList(source, "sourceVisualAssetIds").join(", ")}
                                </span>
                              )}
                            </div>
                            {expertReviewMetadata(source) && (
                              <div className="status-callout">
                                <strong>
                                  Expert review:{" "}
                                  {expertReviewMetadata(source)?.status?.replaceAll("_", " ") ?? "not provided"}
                                </strong>
                                <span>
                                  {[
                                    expertReviewMetadata(source)?.type,
                                    expertReviewMetadata(source)?.reviewer,
                                    expertReviewMetadata(source)?.date,
                                  ]
                                    .filter(Boolean)
                                    .join(" | ") || "No expert review lane, reviewer, or date provided."}
                                </span>
                                {expertReviewMetadata(source)?.notes && (
                                  <span>{expertReviewMetadata(source)?.notes}</span>
                                )}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(card.verifications?.length ?? 0) > 0 && (
                    <div>
                      <strong>Verification</strong>
                      <ul>
                        {card.verifications?.slice(0, 3).map((verification) => (
                          <li key={verification.id}>
                            <span>
                              {formatConfidence(verification.confidence)}
                              {verification.verificationStatus
                                ? ` - ${verification.verificationStatus.replaceAll("_", " ")}`
                                : ""}
                              {verification.verifier ? ` - ${verification.verifier}` : ""}
                            </span>
                            {verification.note && <p>{verification.note}</p>}
                            {(verification.evidence?.length ?? 0) > 0 && (
                              <p>Evidence: {verification.evidence?.join(" | ")}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </details>
              )}
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
                <span>Explanation</span>
                <textarea
                  onChange={(event) => setExplanation(event.target.value)}
                  placeholder="Expanded learner-facing explanation"
                  rows={4}
                  value={explanation}
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
