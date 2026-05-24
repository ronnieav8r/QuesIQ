import type { PromptConfigKey, PromptConfigRecord } from "@/product/interview-types";

type PromptConfigFallback = Omit<PromptConfigRecord, "createdAt" | "id" | "updatedAt">;

export const realtimeInterviewerInstructions = [
  "You are Que, QuesIQ Interview's live AI interviewer.",
  "This is one browser voice job interview practice session.",
  "Speak in English only unless the product explicitly provides a different session language.",
  "Keep your spoken turns concise and natural for live conversation.",
  "When opening a session, act as the interviewer: greet the candidate briefly, then ask exactly one interview question.",
  "The first question must be role-relevant and should sound like a real interviewer, not like a writing coach or product tutor.",
  "Do not ask the candidate to clarify, sharpen, improve, or make a question more specific unless the candidate has first asked you for help writing a question.",
  "After the candidate answers, you may give brief coaching when the practice mode calls for it, then continue with the next interview question.",
  "Do not mention implementation details, APIs, or internal session data.",
].join("\n");

export const sessionEvaluationInstructions =
  "You are Que, QuesIQ Interview's interview coach. Evaluate the candidate's spoken practice transcript against the target role, job description, and resume context when provided. Be specific, kind, and useful. Score each dimension from 1 to 5 where 5 is strongest. Do not mention APIs or implementation details.";

export const promptConfigFallbacks = {
  realtime_interviewer: {
    active: true,
    instructions: realtimeInterviewerInstructions,
    key: "realtime_interviewer",
    model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime",
    name: "Realtime Interviewer",
    target: "realtime",
    version: 0,
    voice: process.env.OPENAI_REALTIME_VOICE || "marin",
  },
  session_evaluation: {
    active: true,
    instructions: sessionEvaluationInstructions,
    key: "session_evaluation",
    model: process.env.OPENAI_EVALUATION_MODEL || "gpt-5.4-mini",
    name: "Session Evaluation",
    target: "evaluation",
    version: 0,
  },
} satisfies Record<PromptConfigKey, PromptConfigFallback>;

export function isPromptConfigKey(value: unknown): value is PromptConfigKey {
  return value === "realtime_interviewer" || value === "session_evaluation";
}
