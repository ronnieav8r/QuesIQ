import {
  claimFinalization,
  createVerificationPhrase,
  followUpResponseInstructions,
  isUserSpeechEvent,
  openingResponseInstructions,
} from "@/lib/voice-proof-utils";
import { describe, expect, it } from "@jest/globals";

describe("native voice proof utilities", () => {
  it("creates a stable three-word phrase from a session id", () => {
    const first = createVerificationPhrase("12345678-1234-1234-1234-123456789abc");
    expect(first.split(" ")).toHaveLength(3);
    expect(createVerificationPhrase("12345678-1234-1234-1234-123456789abc")).toBe(first);
  });

  it("allows only one finalization claim", () => {
    const lock = { current: false };
    expect(claimFinalization(lock)).toBe(true);
    expect(claimFinalization(lock)).toBe(false);
  });

  it("requires English on opening and follow-up responses", () => {
    expect(openingResponseInstructions).toContain("only in clear American English");
    expect(followUpResponseInstructions).toContain("only in clear American English");
  });

  it("recognizes server VAD and transcription events as microphone activity", () => {
    expect(isUserSpeechEvent("input_audio_buffer.speech_started")).toBe(true);
    expect(isUserSpeechEvent("conversation.item.input_audio_transcription.delta")).toBe(true);
    expect(isUserSpeechEvent("conversation.item.input_audio_transcription.completed")).toBe(true);
    expect(isUserSpeechEvent("response.output_audio_transcript.done")).toBe(false);
  });
});
