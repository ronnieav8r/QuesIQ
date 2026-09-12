/** Speak complete feedback/questions; the visible structured choice menu stays on screen. */
export function coachingSpeechText(result: { feedback?: string; question?: string; state?: string }) {
  const question = ["brief_feedback_choice", "more_feedback"].includes(result.state ?? "")
    ? "Choose your next step."
    : result.question;
  return [result.feedback, question].filter(Boolean).join(" ");
}
