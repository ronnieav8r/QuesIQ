type RealtimeAudioInputOptions = {
  silenceDurationMs?: number;
  threshold?: number;
};

export function buildRealtimeAudioInputConfig({
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
      create_response: true,
      interrupt_response: false,
      prefix_padding_ms: 300,
      silence_duration_ms: silenceDurationMs,
      threshold,
      type: "server_vad",
    },
  };
}
