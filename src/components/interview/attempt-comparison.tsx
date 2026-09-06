import type { CoachingAttempt } from "@quesiq/interview-contracts";

export function AttemptComparison({ attempts }: { attempts: CoachingAttempt[] }) {
  const ids = [...new Set(attempts.map((attempt) => attempt.questionId))];
  return <div>
    <h4>Compare attempts</h4><p>Guided retries are assisted practice, not independent score gains. Feedback quality is unreviewed.</p>
    {ids.map((id) => {
      const group = attempts.filter((item) => item.questionId === id);
      const first = group[0]; const latest = group.at(-1)!;
      return <section key={id}><h4>{first.question}</h4><div style={{ display: "grid", gap: 12 }}>
        {(first.id === latest.id ? [first] : [first, latest]).map((attempt) => <article key={attempt.id} style={{ border: "1px solid #34434d", padding: 12, borderRadius: 12, overflowWrap: "anywhere" }}>
          <strong>Attempt {attempt.attemptIndex} · {attempt.assisted ? "Assisted retry" : "First attempt"}</strong>
          <p style={{ whiteSpace: "pre-wrap" }}>{attempt.answer}</p><p>{attempt.feedback}</p>
          {attempt.priority && <p>Focus: {attempt.priority}</p>}
          {attempt.evidence.map((item, index) => <blockquote key={index}>{item.quote}</blockquote>)}
          <small>{attempt.promptProfile} · {attempt.model ?? "Model not recorded"} · {attempt.promptVersions.map((v) => `${v.key} v${v.version}`).join(", ") || "Versions not recorded"}</small>
        </article>)}
      </div></section>;
    })}
  </div>;
}
