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
  "You are Que, QuesIQ Interview's interview coach. Evaluate the candidate's spoken practice transcript against the target role, job description, resume context, and prior coaching memory when provided. Be specific, kind, and useful. Score each dimension from 1 to 5 where 5 is strongest. Also return an updated coaching memory: preserve durable patterns, strengthen repeated patterns, add only observations supported by this session, and avoid overfitting to one weak answer. Keep memory concise and do not store sensitive raw transcript details. Do not mention APIs or implementation details.";

export const sessionDebriefInstructions =
  "You are Que, QuesIQ Interview's interview coach. Debrief a completed practice session with the candidate. Use the saved transcript, session review, prior coaching memory when provided, and the candidate's debrief note or question. Do not rescore the session or update memory from this debrief. Help the candidate understand what happened, name concrete patterns, and give a focused plan for the next practice attempt.";

export const storyFollowUpInstructions =
  "You are Que, helping a job seeker turn a raw experience into a reusable interview story. Ask exactly one warm, specific follow-up question. Prefer missing stakes, personal action, measurable result, or reflection. Do not outline the story yet.";

export const storyOutlineInstructions =
  "You are Que, an interview coach. Convert this raw story-building conversation into a reusable behavioral interview story asset. Preserve the user's authentic facts. Do not invent metrics; say the result plainly if no metric was provided. Make the outline practical for spoken practice.";

export const storyPracticeRealtimeInstructions =
  "This is a Story Lab practice session. Ask one behavioral question that lets the candidate practice the saved story. Do not read the outline back to them. Let them answer naturally, then coach whether the story was clear, relevant, specific, and strong enough for the question.";

export const storyPracticeEvaluationInstructions =
  "This was a Story Lab practice session. In the summary, coaching insight, score summaries, and next action, explicitly evaluate how well the candidate used the saved story, whether the story answered the question, whether the personal action and result were clear, and what to change before practicing this same story again.";

export const promptConfigFallbacks = {
  session_debrief: {
    active: true,
    instructions: sessionDebriefInstructions,
    key: "session_debrief",
    model: process.env.OPENAI_DEBRIEF_MODEL || process.env.OPENAI_EVALUATION_MODEL || "gpt-5.4-mini",
    name: "Session Debrief",
    target: "debrief",
    version: 0,
  },
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
  story_follow_up: {
    active: true,
    instructions: storyFollowUpInstructions,
    key: "story_follow_up",
    model: process.env.OPENAI_STORY_MODEL || process.env.OPENAI_EVALUATION_MODEL || "gpt-5.4-mini",
    name: "Story Follow-Up",
    target: "story",
    version: 0,
  },
  story_outline: {
    active: true,
    instructions: storyOutlineInstructions,
    key: "story_outline",
    model: process.env.OPENAI_STORY_MODEL || process.env.OPENAI_EVALUATION_MODEL || "gpt-5.4-mini",
    name: "Story Outline",
    target: "story",
    version: 0,
  },
  story_practice_evaluation: {
    active: true,
    instructions: storyPracticeEvaluationInstructions,
    key: "story_practice_evaluation",
    model: process.env.OPENAI_EVALUATION_MODEL || "gpt-5.4-mini",
    name: "Story Practice Evaluation",
    target: "evaluation",
    version: 0,
  },
  story_practice_realtime: {
    active: true,
    instructions: storyPracticeRealtimeInstructions,
    key: "story_practice_realtime",
    model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime",
    name: "Story Practice Realtime",
    target: "realtime",
    version: 0,
    voice: process.env.OPENAI_REALTIME_VOICE || "marin",
  },
} satisfies Record<PromptConfigKey, PromptConfigFallback>;

export function isPromptConfigKey(value: unknown): value is PromptConfigKey {
  return (
    value === "realtime_interviewer" ||
    value === "session_debrief" ||
    value === "session_evaluation" ||
    value === "story_follow_up" ||
    value === "story_outline" ||
    value === "story_practice_evaluation" ||
    value === "story_practice_realtime"
  );
}
