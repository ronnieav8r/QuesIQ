"use client";

import { Database, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import type { NclexQuestionView } from "@/features/nclex/types";

type Diagnostic = {
  detail: string;
  key: string;
  status: "error" | "ok" | "warning";
};

export default function NclexAdminApp() {
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [questions, setQuestions] = useState<NclexQuestionView[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitialAdminData() {
      try {
        const [diagnosticsResponse, questionsResponse] = await Promise.all([
          fetch("/api/nclex/admin/diagnostics"),
          fetch("/api/nclex/admin/questions"),
        ]);

        if (!diagnosticsResponse.ok || !questionsResponse.ok) {
          throw new Error("Admin access is required or NCLEX storage is unavailable.");
        }

        const diagnosticsData = (await diagnosticsResponse.json()) as { checks?: Diagnostic[] };
        const questionsData = (await questionsResponse.json()) as { questions?: NclexQuestionView[] };
        setDiagnostics(diagnosticsData.checks ?? []);
        setQuestions(questionsData.questions ?? []);
        setNotice(null);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "NCLEX admin data could not be loaded.");
      }
    }

    void loadInitialAdminData();
  }, []);

  return (
    <main className="app-shell">
      <section className="screen">
        <div className="section-head">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>NCLEX content control</h1>
            <p>
              Structural admin surface for reviewed question-bank diagnostics, deterministic
              selector visibility, and future import/review workflows.
            </p>
          </div>
          <ShieldCheck />
        </div>

        {notice && (
          <div className="panel">
            <strong>NCLEX admin notice</strong>
            <p>{notice}</p>
          </div>
        )}

        <div className="grid three-col">
          {diagnostics.map((check) => (
            <article className="panel" key={check.key}>
              <strong>{check.key.replaceAll("_", " ")}</strong>
              <p>{check.detail}</p>
              <span className="pill">{check.status}</span>
            </article>
          ))}
        </div>

        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Question library preview</h2>
              <p>Only published/reviewed learner-safe items are shown in this V1 preview.</p>
            </div>
            <Database />
          </div>
          <div className="grid">
            {questions.map((question) => (
              <article className="raised-card" key={question.id}>
                <strong>{question.prompt}</strong>
                <p>
                  {question.category.title}
                  {question.clinicalJudgmentStep
                    ? ` - ${question.clinicalJudgmentStep.title}`
                    : ""}
                </p>
              </article>
            ))}
            {questions.length === 0 && (
              <div className="raised-card">
                <strong>No published NCLEX items yet</strong>
                <p>
                  The NCLEX lane is ready for reviewed content import, but the learner selector will
                  stay empty until questions are published.
                </p>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
