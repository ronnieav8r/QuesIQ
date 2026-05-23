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
    questionTypeRequired: false,
    use: "Your intro and early presence",
  },
  {
    description: "Work through answers with Que coaching in the moment.",
    key: "coaching",
    name: "Coaching",
    questionTypeRequired: true,
    use: "Focused answer improvement",
  },
  {
    description: "Respond under pace and build spoken confidence.",
    key: "rapid_fire",
    name: "Rapid Fire",
    questionTypeRequired: true,
    use: "Speed and recovery",
  },
  {
    description: "Run a realistic session without coaching interruptions.",
    key: "mock_interview",
    name: "Mock Interview",
    questionTypeRequired: false,
    use: "Full interview simulation",
  },
];

export const questionTypes: QuestionType[] = [
  { key: "behavioral", label: "Behavioral" },
  { key: "technical", label: "Technical" },
  { key: "hypothetical", label: "Hypothetical" },
  { key: "motivational", label: "Motivational" },
];

export const interviewStyles: InterviewStyle[] = [
  {
    description: "Supportive, warm, and encouraging.",
    key: "friendly",
    label: "Friendly",
  },
  {
    description: "Professional and balanced.",
    key: "neutral",
    label: "Neutral",
  },
  {
    description: "Direct, skeptical, and higher pressure.",
    key: "tough",
    label: "Tough",
  },
];

export const fallbackInterviewCatalog: InterviewCatalog = {
  interviewStyles,
  practiceModes,
  questionTypes,
};
