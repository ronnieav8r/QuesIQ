"use client";

import { useEffect, useMemo, useState } from "react";

import type { InterviewQuestionRecord, QuestionTypeKey } from "@/product/interview-types";

type QuestionBankPickerProps = {
  launchPending: boolean;
  onPracticeQuestion: (question: InterviewQuestionRecord) => void;
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

export function QuestionBankPicker({
  launchPending,
  onPracticeQuestion,
}: QuestionBankPickerProps) {
  const [customQuestionText, setCustomQuestionText] = useState("");
  const [customTargetSkill, setCustomTargetSkill] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<InterviewQuestionRecord[]>([]);
  const [recommendations, setRecommendations] = useState<InterviewQuestionRecord[]>([]);
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

  const visibleRecommendations = useMemo(() => {
    const ids = new Set(questions.map((question) => question.id));
    return recommendations.filter((question) => ids.has(question.id));
  }, [questions, recommendations]);

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
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Question could not be saved.");
    } finally {
      setSavingCustom(false);
    }
  }

  return (
    <section className="question-bank-picker" aria-labelledby="question-bank-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Choose a Question</p>
          <h2 id="question-bank-title">Practice one exact question</h2>
        </div>
        <span>{loading ? "Loading" : `${questions.length} available`}</span>
      </div>

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
        <div className="question-bank-recommendations">
          <strong>Practice again</strong>
          {visibleRecommendations.slice(0, 3).map((question) => (
            <button
              disabled={launchPending}
              key={question.id}
              onClick={() => onPracticeQuestion(question)}
              type="button"
            >
              {question.questionText}
            </button>
          ))}
        </div>
      )}

      <div className="question-bank-add">
        <label>
          <span>Add your own question</span>
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
          {savingCustom ? "Saving" : "Add Question"}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="question-card-list">
        {questions.map((question) => (
          <article className="question-card" key={question.id}>
            <div>
              <strong>{question.questionText}</strong>
              <p>{question.suggestedUse || question.targetSkill || "One-question coaching practice."}</p>
            </div>
            <dl>
              <div>
                <dt>Type</dt>
                <dd>{question.questionTypeKey || "General"}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{question.source === "official" ? question.sourceLabel : "Private"}</dd>
              </div>
              <div>
                <dt>Skill</dt>
                <dd>{question.targetSkill || "Open practice"}</dd>
              </div>
            </dl>
            <button disabled={launchPending} onClick={() => onPracticeQuestion(question)} type="button">
              {launchPending ? "Launching" : "Practice This Question"}
            </button>
          </article>
        ))}
        {!loading && questions.length === 0 && <p>No matching questions found.</p>}
      </div>
    </section>
  );
}
