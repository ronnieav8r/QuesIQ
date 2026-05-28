type RealtimeAudioInputOptions = {
  createResponse?: boolean;
  silenceDurationMs?: number;
  threshold?: number;
};

export function buildRealtimeAudioInputConfig({
  createResponse = true,
  silenceDurationMs = 800,
  threshold = 0.72,
}: RealtimeAudioInputOptions = {}) {
  return {
    noise_reduction: {
      type: "near_field",
    },
    transcription: {
      model: "gpt-4o-mini-transcribe",
    },
    turn_detection: {
      create_response: createResponse,
      interrupt_response: false,
      prefix_padding_ms: 300,
      silence_duration_ms: silenceDurationMs,
      threshold,
      type: "server_vad",
    },
  };
}
