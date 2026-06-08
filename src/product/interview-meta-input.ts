import type { VoiceSessionArtifactDraft } from "@/product/interview-types";

const metaOrTestPatterns = [
  /^(testing|test)(\s+\d+|\s+one|\s+two|\s+three|\s+four|\s+five|[\s,.-])*$/i,
  /\btesting\s+(one|1)[,\s-]+(two|2)[,\s-]+(three|3)\b/i,
  /\bmic check\b/i,
  /\bmicrophone check\b/i,
  /\bcan you hear me\b/i,
  /\bis this working\b/i,
  /\bchecking (the )?(interface|audio|mic|microphone)\b/i,
  /\bjust making sure (this|it) works\b/i,
  /\bhold on\b/i,
  /\bwait a second\b/i,
];

export function isMetaOrTestInput(text?: string) {
  const normalized = text?.toLowerCase().trim() ?? "";

  if (!normalized) {
    return false;
  }

  return metaOrTestPatterns.some((pattern) => pattern.test(normalized));
}

export function hasUsableInterviewAnswerContent(artifact: VoiceSessionArtifactDraft) {
  return artifact.transcript.some((turn) => {
    const isUserTurn = turn.role === "user" || turn.speaker.toLowerCase() === "you";
    return isUserTurn && !isMetaOrTestInput(turn.text);
  });
}

