import type {
  InterviewContext,
  InterviewCatalog,
  InterviewStyle,
  PracticeMode,
  QuestionType,
} from "./interview-types";

export const initialInterviewContext: InterviewContext = {
  jobDescription: "",
  preferredName: "",
  targetCompany: "",
  targetRole: "",
};

export const practiceModes: PracticeMode[] = [
  {
    description: "Shape the opening answer that sets the tone.",
    key: "first_impression",
    name: "First Impression",
    promptInstructions:
      "Run this as a short opening-impression practice. Ask for a concise introduction or 'tell me about yourself' style answer, then help the candidate make the opening clear, confident, and role-relevant.",
    questionTypeRequired: false,
    use: "Your intro and early presence",
  },
  {
    description: "Work through answers with Que coaching in the moment.",
    key: "coaching",
    name: "Coaching",
    promptInstructions:
      "Run this as an interactive coaching session. Ask one focused question, let the candidate answer, give brief actionable coaching, then ask a tighter follow-up or retry prompt.",
    questionTypeRequired: true,
    use: "Focused answer improvement",
  },
  {
    description: "Respond under pace and build spoken confidence.",
    key: "rapid_fire",
    name: "Rapid Fire",
    promptInstructions:
      "Run this as paced repetition. Ask short interview questions one at a time, keep feedback minimal between answers, and help the candidate build speed, composure, and recovery.",
    questionTypeRequired: true,
    use: "Speed and recovery",
  },
  {
    description: "Run a realistic session without coaching interruptions.",
    key: "mock_interview",
    name: "Mock Interview",
    promptInstructions:
      "Run this as a realistic interview simulation. Ask one question at a time, avoid coaching during the interview unless the candidate asks, and keep the flow professional.",
    questionTypeRequired: false,
    use: "Full interview simulation",
  },
];

export const questionTypes: QuestionType[] = [
  {
    key: "behavioral",
    label: "Behavioral",
    promptInstructions:
      "Focus on past experience, behavior, collaboration, conflict, leadership, ownership, and examples with enough context, action, and result.",
  },
  {
    key: "technical",
    label: "Technical",
    promptInstructions:
      "Focus on role-relevant technical depth. Ask the candidate to explain decisions, tradeoffs, troubleshooting, systems, tools, or methods clearly for the target role.",
  },
  {
    key: "hypothetical",
    label: "Hypothetical",
    promptInstructions:
      "Focus on how the candidate would reason through a realistic future scenario. Look for structure, assumptions, tradeoffs, and practical next steps.",
  },
  {
    key: "motivational",
    label: "Motivational",
    promptInstructions:
      "Focus on motivation, fit, goals, company interest, role interest, and the candidate's ability to connect their background to the opportunity.",
  },
];

export const interviewStyles: InterviewStyle[] = [
  {
    description: "Supportive, warm, and encouraging.",
    key: "friendly",
    label: "Friendly",
    promptInstructions:
      "Use a warm, encouraging tone. Keep pressure low, affirm useful pieces of the answer, and offer constructive guidance without sounding soft or vague.",
  },
  {
    description: "Professional and balanced.",
    key: "neutral",
    label: "Neutral",
    promptInstructions:
      "Use a calm, professional interviewer tone. Keep feedback balanced and direct, with realistic follow-ups and no exaggerated praise.",
  },
  {
    description: "Direct, skeptical, and higher pressure.",
    key: "tough",
    label: "Tough",
    promptInstructions:
      "Use a direct, higher-pressure interviewer tone. Ask sharper follow-ups, challenge vague answers, and stay professional rather than harsh.",
  },
];

export const fallbackInterviewCatalog: InterviewCatalog = {
  interviewStyles,
  practiceModes,
  questionTypes,
};
