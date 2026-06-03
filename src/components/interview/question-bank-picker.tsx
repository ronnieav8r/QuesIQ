"use client";

import { useEffect, useMemo, useState } from "react";

import type { InterviewQuestionRecord, QuestionTypeKey } from "@/product/interview-types";

type QuestionBankPickerProps = {
  launchPending: boolean;
  onBack: () => void;
  onPracticeQueue: (questions: InterviewQuestionRecord[]) => void;
};

type QuestionBankResponse = {
  questions?: InterviewQuestionRecord[];
  recommendations?: InterviewQuestionRecord[];
};

const questionTypes: { key: "" | QuestionTypeKey; label: string }[] = [
  { key: "", label: "All" },
  { key: "behavioral", label: "Behavioral" },
  { key: "technical", label: "Technical" },
  { key: "hypothetical", label: "Hypothetical" },
  { key: "motivational", label: "Motivational" },
];

function questionTypeLabel(type?: QuestionTypeKey) {
  return questionTypes.find((questionType) => questionType.key === type)?.label || "General";
}

export function QuestionBankPicker({
  launchPending,
  onBack,
  onPracticeQueue,
}: QuestionBankPickerProps) {
  const [customQuestionText, setCustomQuestionText] = useState("");
  const [customTargetSkill, setCustomTargetSkill] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<InterviewQuestionRecord[]>([]);
  const [recommendations, setRecommendations] = useState<InterviewQuestionRecord[]>([]);
  const [queue, setQueue] = useState<InterviewQuestionRecord[]>([]);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<"" | QuestionTypeKey>("");
  const [savingCustom, setSavingCustom] = useState(false);

  async function loadQuestions() {
    setLoading(true);
    setError(undefined);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (selectedType) params.set("type", selectedType);
      const response = await fetch(`/api/interview/questions?${params.toString()}`);
      const body = (await response.json()) as QuestionBankResponse & { error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Questions could not be loaded.");
      }

      setQuestions(body.questions ?? []);
      setRecommendations(body.recommendations ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Questions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadQuestions();
    }, 150);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedType]);

  const queuedIds = useMemo(
    () => new Set(queue.map((question) => question.id)),
    [queue],
  );
  const visibleRecommendations = useMemo(() => {
    const ids = new Set(questions.map((question) => question.id));
    return recommendations.filter((question) => ids.has(question.id));
  }, [questions, recommendations]);

  function addToQueue(question: InterviewQuestionRecord) {
    setQueue((current) => {
      if (current.some((item) => item.id === question.id) || current.length >= 10) {
        return current;
      }

      return [...current, question];
    });
  }

  function removeFromQueue(questionId: string) {
    setQueue((current) => current.filter((question) => question.id !== questionId));
  }

  async function addCustomQuestion() {
    if (!customQuestionText.trim()) {
      setError("Write a question first.");
      return;
    }

    setSavingCustom(true);
    setError(undefined);
    try {
      const response = await fetch("/api/interview/questions", {
        body: JSON.stringify({
          compatibleModes: ["coaching"],
          questionText: customQuestionText,
          questionTypeKey: selectedType || undefined,
          targetSkill: customTargetSkill,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as {
        error?: string;
        question?: InterviewQuestionRecord;
      };

      if (!response.ok || !body.question) {
        throw new Error(body.error || "Question could not be saved.");
      }

      setCustomQuestionText("");
      setCustomTargetSkill("");
      setQuestions((current) => [body.question as InterviewQuestionRecord, ...current]);
      addToQueue(body.question);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Question could not be saved.");
    } finally {
      setSavingCustom(false);
    }
  }

  return (
    <section className="screen question-queue-screen" aria-labelledby="question-bank-title">
      <div className="screen-toolbar">
        <button aria-label="Go back" className="back-button" onClick={onBack} type="button">
          Back
        </button>
        <div>
          <p className="eyebrow">Question Queue</p>
          <h1 id="question-bank-title">Build a custom practice queue</h1>
        </div>
      </div>

      <section className="question-queue-summary" aria-label="Queued questions">
        <div>
          <p className="eyebrow">Friendly Coaching</p>
          <h2>{queue.length || "No"} queued {queue.length === 1 ? "question" : "questions"}</h2>
          <p>
            Que will ask these exact questions in order, then save the session for review.
          </p>
        </div>
        <div className="stacked-actions">
          <button
            disabled={launchPending || queue.length === 0}
            onClick={() => onPracticeQueue(queue)}
            type="button"
          >
            {launchPending ? "Launching" : "Launch Queue"}
          </button>
          {queue.length > 0 && (
            <button className="secondary" onClick={() => setQueue([])} type="button">
              Clear Queue
            </button>
          )}
        </div>
      </section>

      {queue.length > 0 && (
        <ol className="queued-question-list" aria-label="Selected question order">
          {queue.map((question, index) => (
            <li key={question.id}>
              <span>{index + 1}</span>
              <p>{question.questionText}</p>
              <button
                className="secondary"
                onClick={() => removeFromQueue(question.id)}
                type="button"
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="question-bank-controls">
        <label>
          <span>Search</span>
          <input
            placeholder="Search questions, skills, or tags"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="component-tabs" aria-label="Question type filter">
          {questionTypes.map((type) => (
            <button
              aria-pressed={selectedType === type.key}
              className={selectedType === type.key ? "active" : undefined}
              key={type.key || "all"}
              onClick={() => setSelectedType(type.key)}
              type="button"
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {visibleRecommendations.length > 0 && (
        <section className="question-bank-recommendations" aria-label="Practice again">
          <strong>Practice again</strong>
          <div className="question-row-list">
            {visibleRecommendations.slice(0, 3).map((question) => (
              <button
                disabled={queuedIds.has(question.id)}
                key={question.id}
                onClick={() => addToQueue(question)}
                type="button"
              >
                {question.questionText}
              </button>
            ))}
          </div>
        </section>
      )}

      <details className="question-bank-add">
        <summary>Add your own question</summary>
        <label>
          <span>Question</span>
          <textarea
            placeholder="Paste or write a question you want to practice."
            value={customQuestionText}
            onChange={(event) => setCustomQuestionText(event.target.value)}
          />
        </label>
        <label>
          <span>Target skill</span>
          <input
            placeholder="Optional, e.g. conflict, leadership, role fit"
            value={customTargetSkill}
            onChange={(event) => setCustomTargetSkill(event.target.value)}
          />
        </label>
        <button disabled={savingCustom} onClick={addCustomQuestion} type="button">
          {savingCustom ? "Saving" : "Add to Queue"}
        </button>
      </details>

      {error && <p className="form-error">{error}</p>}

      <section className="question-row-list" aria-label="Available questions">
        <div className="section-head">
          <h2>Available Questions</h2>
          <span>{loading ? "Loading" : `${questions.length} available`}</span>
        </div>
        {questions.map((question) => {
          const queued = queuedIds.has(question.id);

          return (
            <article className="question-row" key={question.id}>
              <div>
                <strong>{question.questionText}</strong>
                <p>
                  {questionTypeLabel(question.questionTypeKey)} /{" "}
                  {question.targetSkill || question.suggestedUse || "Open practice"}
                </p>
              </div>
              <span>{question.source === "official" ? question.sourceLabel : "Private"}</span>
              <button
                disabled={queued || queue.length >= 10}
                onClick={() => addToQueue(question)}
                type="button"
              >
                {queued ? "Queued" : "Add"}
              </button>
            </article>
          );
        })}
        {!loading && questions.length === 0 && <p>No matching questions found.</p>}
      </section>
    </section>
  );
}
