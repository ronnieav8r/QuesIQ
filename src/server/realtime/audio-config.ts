export function buildRealtimeAudioInputConfig() {
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
      silence_duration_ms: 800,
      threshold: 0.72,
      type: "server_vad",
    },
  };
}
