export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.INTERVIEW_COACHING_PILOT_ENABLED === "1") {
    const { ensureTranscriptionSupervisor } = await import("./server/interview/transcription-supervisor");
    await ensureTranscriptionSupervisor();
  }
}
