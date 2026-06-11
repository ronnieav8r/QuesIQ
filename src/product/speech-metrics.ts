import type { VoiceSessionArtifactDraft, VoiceTranscriptTurn } from "@/product/interview-types";

const turnBasedRecordingTimingSource = "turn_based_recording_window" as const;

export type SpeechSummary = {
  answeredTurnCountWithWpm: number;
  averageWordsPerMinute: number;
  timingSource: typeof turnBasedRecordingTimingSource;
  totalUserAnswerDurationSeconds: number;
  totalUserWords: number;
};

const fillerOnlyPattern = /^(?:um+|uh+|er+|ah+|hmm+|test(?:ing)?|one|two|three|four|five|can you hear me|hello|okay|ok|yes|no|yeah|yep|nope|thanks|thank you|look|in the|the|a|an|and|or|so|well|like|you know|\.|,|\s)+$/i;

function isUserTurn(turn: Pick<VoiceTranscriptTurn, "role" | "speaker">) {
  return turn.role === "user" || turn.speaker === "You";
}

function countSpokenWords(text: string) {
  const matches = text
    .trim()
    .match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g);

  return matches?.length ?? 0;
}

export function getTurnSpeechMetrics(input: {
  answerDurationSeconds?: number;
  text: string;
}): Pick<VoiceTranscriptTurn, "answerDurationSeconds" | "timingSource" | "wordCount" | "wordsPerMinute"> {
  const answerDurationSeconds =
    input.answerDurationSeconds !== undefined && Number.isFinite(input.answerDurationSeconds)
      ? Math.max(0, Math.round(input.answerDurationSeconds))
      : undefined;
  const wordCount = countSpokenWords(input.text);
  const normalizedText = input.text.trim().toLowerCase();

  if (
    answerDurationSeconds === undefined ||
    answerDurationSeconds < 5 ||
    wordCount < 3 ||
    !normalizedText ||
    fillerOnlyPattern.test(normalizedText)
  ) {
    return {};
  }

  return {
    answerDurationSeconds,
    timingSource: turnBasedRecordingTimingSource,
    wordCount,
    wordsPerMinute: Math.round((wordCount / answerDurationSeconds) * 60),
  };
}

export function getSpeechSummary(
  artifact: Pick<VoiceSessionArtifactDraft, "transcript">,
): SpeechSummary | undefined {
  const userTurnsWithMetrics = artifact.transcript.filter(
    (
      turn,
    ): turn is VoiceTranscriptTurn & {
      answerDurationSeconds: number;
      timingSource: typeof turnBasedRecordingTimingSource;
      wordCount: number;
      wordsPerMinute: number;
    } =>
      isUserTurn(turn) &&
      turn.timingSource === turnBasedRecordingTimingSource &&
      typeof turn.answerDurationSeconds === "number" &&
      typeof turn.wordCount === "number" &&
      typeof turn.wordsPerMinute === "number" &&
      turn.answerDurationSeconds >= 5 &&
      turn.wordCount >= 3,
  );

  if (userTurnsWithMetrics.length === 0) {
    return undefined;
  }

  const totalUserWords = userTurnsWithMetrics.reduce((sum, turn) => sum + turn.wordCount, 0);
  const totalUserAnswerDurationSeconds = userTurnsWithMetrics.reduce(
    (sum, turn) => sum + turn.answerDurationSeconds,
    0,
  );

  if (totalUserWords <= 0 || totalUserAnswerDurationSeconds <= 0) {
    return undefined;
  }

  return {
    answeredTurnCountWithWpm: userTurnsWithMetrics.length,
    averageWordsPerMinute: Math.round((totalUserWords / totalUserAnswerDurationSeconds) * 60),
    timingSource: turnBasedRecordingTimingSource,
    totalUserAnswerDurationSeconds,
    totalUserWords,
  };
}
