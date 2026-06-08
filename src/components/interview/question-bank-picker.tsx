"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import type { InterviewQuestionRecord, QuestionTypeKey } from "@/product/interview-types";

type QuestionBankPickerProps = {
  launchPending: boolean;
  onBack: () => void;
  onPracticeQueue: (questions: InterviewQuestionRecord[]) => void;
};

type QuestionBankResponse = {
  questions?: InterviewQuestionRecord[];
  recommendations?: InterviewQuestionRecord[];
  targetSkills?: string[];
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
  const [selectedSkill, setSelectedSkill] = useState("");
  const [selectedType, setSelectedType] = useState<"" | QuestionTypeKey>("");
  const [savingCustom, setSavingCustom] = useState(false);
  const [targetSkills, setTargetSkills] = useState<string[]>([]);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string>();

  async function loadQuestions() {
    setLoading(true);
    setError(undefined);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (selectedType) params.set("type", selectedType);
      if (selectedSkill) params.set("skill", selectedSkill);
      const response = await fetch(`/api/interview/questions?${params.toString()}`);
      const body = (await response.json()) as QuestionBankResponse & { error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Questions could not be loaded.");
      }

      setQuestions(body.questions ?? []);
      setRecommendations(body.recommendations ?? []);
      setTargetSkills(body.targetSkills ?? []);
      setCustomTargetSkill((current) => current || body.targetSkills?.[0] || "");
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
  }, [search, selectedSkill, selectedType]);

  const queuedIds = useMemo(
    () => new Set(queue.map((question) => question.id)),
    [queue],
  );
  const visibleRecommendations = useMemo(() => {
    const ids = new Set(questions.map((question) => question.id));
    return recommendations.filter((question) => ids.has(question.id) && !queuedIds.has(question.id));
  }, [questions, queuedIds, recommendations]);

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

  function moveQueuedQuestion(questionId: string, direction: -1 | 1) {
    setQueue((current) => {
      const index = current.findIndex((question) => question.id === questionId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  function preserveScrollAfterFilterChange(callback: () => void) {
    const scrollY = window.scrollY;
    callback();
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY });
      window.requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
    });
  }

  async function deleteCustomQuestion(questionId: string) {
    setDeletingQuestionId(questionId);
    setError(undefined);
    try {
      const response = await fetch(`/api/interview/questions/${questionId}`, {
        method: "DELETE",
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Question could not be deleted.");
      }

      setQueue((current) => current.filter((question) => question.id !== questionId));
      setQuestions((current) => current.filter((question) => question.id !== questionId));
      setRecommendations((current) =>
        current.filter((question) => question.id !== questionId),
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Question could not be deleted.",
      );
    } finally {
      setDeletingQuestionId(undefined);
    }
  }

  async function addCustomQuestion() {
    if (!customQuestionText.trim()) {
      setError("Write a question first.");
      return;
    }
    if (!customTargetSkill.trim()) {
      setError("Choose a target skill for this question.");
      return;
    }

    setSavingCustom(true);
    setError(undefined);
    try {
      const response = await fetch("/api/interview/questions", {
        body: JSON.stringify({
          compatibleModes: ["coaching", "rapid_fire"],
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
      setCustomTargetSkill(targetSkills[0] || "");
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
          <p className="eyebrow">Active queue</p>
          <h2>{queue.length || "No"} queued {queue.length === 1 ? "question" : "questions"}</h2>
          <p>
            Que will ask these exact questions in order, then show Rapid review results at
            the end.
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
              <span className="queue-order-badge">{index + 1}</span>
              <div>
                <p>{question.questionText}</p>
                <small>{question.targetSkill || questionTypeLabel(question.questionTypeKey)}</small>
              </div>
              <div className="queue-order-actions" aria-label="Queue item actions">
                <button
                  aria-label={`Move question ${index + 1} up`}
                  className="secondary queue-icon-action"
                  disabled={index === 0}
                  onClick={() => moveQueuedQuestion(question.id, -1)}
                  type="button"
                >
                  <ArrowUp aria-hidden="true" />
                </button>
                <button
                  aria-label={`Move question ${index + 1} down`}
                  className="secondary queue-icon-action"
                  disabled={index === queue.length - 1}
                  onClick={() => moveQueuedQuestion(question.id, 1)}
                  type="button"
                >
                  <ArrowDown aria-hidden="true" />
                </button>
                <button
                  className="secondary"
                  onClick={() => removeFromQueue(question.id)}
                  type="button"
                >
                  Remove
                </button>
              </div>
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
        <div className="question-bank-filter-group">
          <h3>Question type</h3>
          <div className="component-tabs" aria-label="Question type filter">
            {questionTypes.map((type) => (
              <button
                aria-pressed={selectedType === type.key}
                className={selectedType === type.key ? "active" : undefined}
                key={type.key || "all"}
                onClick={(event) => {
                  event.currentTarget.blur();
                  preserveScrollAfterFilterChange(() => setSelectedType(type.key));
                }}
                type="button"
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
        {targetSkills.length > 0 && (
          <div className="question-bank-filter-group">
            <h3>Target skill</h3>
            <div className="skill-filter-strip" aria-label="Target skill filter">
              <button
                aria-pressed={selectedSkill === ""}
                className={selectedSkill === "" ? "active" : undefined}
                onClick={(event) => {
                  event.currentTarget.blur();
                  preserveScrollAfterFilterChange(() => setSelectedSkill(""));
                }}
                type="button"
              >
                All skills
              </button>
              {targetSkills.map((skill) => (
                <button
                  aria-pressed={selectedSkill === skill}
                  className={selectedSkill === skill ? "active" : undefined}
                  key={skill}
                  onClick={(event) => {
                    event.currentTarget.blur();
                    preserveScrollAfterFilterChange(() => setSelectedSkill(skill));
                  }}
                  type="button"
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {visibleRecommendations.length > 0 && (
        <section className="question-bank-recommendations" aria-label="Practice again">
          <strong>Practice again</strong>
          <div className="question-row-list">
            {visibleRecommendations.slice(0, 3).map((question) => (
              <article className="question-row compact" key={question.id}>
                <div>
                  <strong>{question.questionText}</strong>
                  <p>{question.targetSkill || questionTypeLabel(question.questionTypeKey)}</p>
                </div>
                <button
                  className="compact-action"
                  disabled={queue.length >= 10}
                  onClick={() => addToQueue(question)}
                  type="button"
                >
                  Add
                </button>
              </article>
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
          <select
            disabled={targetSkills.length === 0}
            value={customTargetSkill}
            onChange={(event) => setCustomTargetSkill(event.target.value)}
          >
            {targetSkills.length === 0 ? (
              <option value="">No preset skills available</option>
            ) : (
              targetSkills.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))
            )}
          </select>
        </label>
        <button
          disabled={savingCustom || !customTargetSkill.trim()}
          onClick={addCustomQuestion}
          type="button"
        >
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
              <div className="question-row-actions">
                <button
                  className="compact-action"
                  disabled={queued || queue.length >= 10}
                  onClick={() => addToQueue(question)}
                  type="button"
                >
                  {queued ? "Queued" : "Add"}
                </button>
                {question.source === "custom" && (
                  <button
                    className="secondary compact-action danger"
                    disabled={deletingQuestionId === question.id}
                    onClick={() => void deleteCustomQuestion(question.id)}
                    type="button"
                  >
                    {deletingQuestionId === question.id ? "Deleting" : "Delete"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {!loading && questions.length === 0 && <p>No matching questions found.</p>}
      </section>
    </section>
  );
}
