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
      "Run this as a first-minute interview opening practice. Start like a real interviewer with one natural version of 'Tell me about yourself' or 'Walk me through your background as it relates to this role.' Let the candidate give the full opening answer before coaching. After the answer, focus feedback on first impression: clarity of opening, confidence, role relevance, specificity, length, and whether the answer gives the interviewer a useful next thread. Ask for one retry when helpful. Do not turn this into a broad mock interview or a rapid-fire drill.",
    questionTypeRequired: false,
    use: "Your intro and early presence",
  },
  {
    description: "Work through answers with Que coaching in the moment.",
    key: "coaching",
    name: "Coaching",
    promptInstructions:
      "Run this as an interactive answer-improvement session. Ask one focused interview question tied to the selected question focus, then let the candidate answer completely before coaching. After each answer, give one concise, specific coaching note tied to what they actually said, then ask either a tighter follow-up question or a retry prompt that lets them immediately improve the same answer. Keep the loop question, answer, coach, retry/follow-up. Do not save all feedback for the end, and do not interrupt mid-answer.",
    questionTypeRequired: true,
    use: "Focused answer improvement",
  },
  {
    description: "Respond under pace and build spoken confidence.",
    key: "rapid_fire",
    name: "Rapid Fire",
    promptInstructions:
      "Run this as a paced repetition drill for composure and quick recall. Ask short, realistic interview questions one at a time. Keep transitions brisk: brief acknowledgment, then the next question. Give little or no coaching between answers unless the candidate is stuck; save deeper coaching for a short wrap-up pattern after several questions. Favor variety within the selected question focus, including one recovery-style follow-up if an answer is vague. Do not ask multi-part questions, and do not let the session become a long coaching conversation.",
    questionTypeRequired: true,
    use: "Speed and recovery",
  },
  {
    description: "Run a realistic session without coaching interruptions.",
    key: "mock_interview",
    name: "Mock Interview",
    promptInstructions:
      "Run this as a realistic interview simulation. Open professionally, ask one interview question at a time, and behave like an interviewer conducting the session rather than a coach. Use the selected question focus when provided, but mix in natural role-relevant follow-ups when the candidate's answer warrants it. Do not give coaching, scoring, or meta commentary during the interview unless the candidate explicitly asks to pause for coaching. Keep follow-ups realistic: probe vague claims, ask for examples, clarify impact, or move to the next question. Save evaluation for the post-session review.",
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
