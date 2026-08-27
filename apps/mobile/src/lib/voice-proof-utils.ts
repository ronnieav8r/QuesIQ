const proofWords = [
  "amber", "beacon", "cedar", "comet", "harbor", "maple", "orbit", "river",
  "runway", "silver", "summit", "tango", "violet", "willow", "winter", "zephyr",
];

export const openingResponseInstructions = [
  "Respond only in clear American English.",
  "Follow the session Interview instructions.",
  "Welcome the candidate in one short sentence, then ask exactly one interview question.",
].join(" ");

export const followUpResponseInstructions =
  "Respond only in clear American English and follow the session Interview instructions.";

export function isUserSpeechEvent(type?: string) {
  return type === "input_audio_buffer.speech_started"
    || type === "conversation.item.input_audio_transcription.delta"
    || type === "conversation.item.input_audio_transcription.completed";
}

export function createVerificationPhrase(sessionId: string) {
  const hex = sessionId.replace(/[^a-fA-F0-9]/g, "").padEnd(6, "0");
  return [0, 2, 4]
    .map((offset) => proofWords[Number.parseInt(hex.slice(offset, offset + 2), 16) % proofWords.length])
    .join(" ");
}

export function claimFinalization(lock: { current: boolean }) {
  if (lock.current) return false;
  lock.current = true;
  return true;
}
