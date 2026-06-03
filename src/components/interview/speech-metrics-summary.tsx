import type { VoiceSessionArtifactDraft, VoiceTranscriptTurn } from "@/product/interview-types";
import { getSpeechSummary } from "@/product/speech-metrics";

type SessionSpeechMetricsProps = {
  artifact?: Pick<VoiceSessionArtifactDraft, "transcript">;
};

type TurnSpeechMetricProps = {
  turn: VoiceTranscriptTurn;
};

function formatDuration(seconds: number) {
  return `${seconds}s`;
}

export function SessionSpeechMetrics({ artifact }: SessionSpeechMetricsProps) {
  const summary = artifact ? getSpeechSummary(artifact) : undefined;

  if (!summary) {
    return null;
  }

  return (
    <div className="speech-metrics-card" aria-label="Speech delivery metrics">
      <div>
        <span>Average pace</span>
        <strong>{summary.averageWordsPerMinute} WPM</strong>
      </div>
      <div>
        <span>Spoken words</span>
        <strong>{summary.totalUserWords}</strong>
      </div>
      <div>
        <span>Answer time</span>
        <strong>{formatDuration(summary.totalUserAnswerDurationSeconds)}</strong>
      </div>
    </div>
  );
}

export function TurnSpeechMetric({ turn }: TurnSpeechMetricProps) {
  if (
    typeof turn.wordsPerMinute !== "number" ||
    typeof turn.wordCount !== "number" ||
    typeof turn.answerDurationSeconds !== "number"
  ) {
    return null;
  }

  return (
    <small className="speech-turn-metric">
      {turn.wordsPerMinute} WPM / {turn.wordCount} words /{" "}
      {formatDuration(turn.answerDurationSeconds)}
    </small>
  );
}
