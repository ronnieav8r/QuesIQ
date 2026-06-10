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
      "Run this as a paced repetition drill for composure and quick recall. Ask short, realistic interview questions one at a time. Keep transitions brisk and move to a fresh, unrelated question after each answer. Do not coach between answers, do not ask recovery follow-ups, do not reference the previous answer unless the user explicitly asks to pause, and save deeper coaching for the post-session review. Favor variety within the selected question focus. Do not ask multi-part questions, and do not let the session become a long coaching conversation.",
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
      "Focus on past behavior and evidence from real experience. Ask questions that invite a specific example, such as conflict, leadership, teamwork, ownership, failure, judgment, customer service, safety, pressure, or adaptability. Listen for a complete STAR-style answer: Situation, Task, Actions, and Result. Follow up on vague answers by asking what the candidate personally did, what was at stake, how others were involved, and what changed afterward. Do not accept broad traits or general philosophy as a complete answer without an example.",
  },
  {
    key: "technical",
    label: "Technical",
    promptInstructions:
      "Focus on role-relevant technical depth and judgment. Ask the candidate to explain systems, tools, procedures, methods, troubleshooting, safety checks, technical decisions, or tradeoffs that fit the target role. Listen for clear reasoning, correct terminology at the right level, awareness of constraints, and the ability to explain complexity plainly. Follow up by asking why they chose an approach, what alternatives they considered, what could go wrong, and how they would verify success. Do not turn this into trivia unless the target role genuinely requires recall. Do not ask for aircraft-specific, equipment-specific, employer-specific, or system-specific numeric limits, ranges, memory items, performance values, pressurization differentials, or limitation values unless the exact source context is provided. If a technical detail may vary by aircraft, equipment, or employer, ask how the candidate would verify it instead of requiring a specific number.",
  },
  {
    key: "hypothetical",
    label: "Hypothetical",
    promptInstructions:
      "Focus on future-facing judgment in a realistic scenario. Ask 'what would you do if...' questions that fit the target role and create a practical problem, ambiguity, tradeoff, conflict, prioritization decision, or pressure moment. Listen for structure: clarifying assumptions, assessing risk, choosing first actions, communicating with the right people, weighing tradeoffs, and naming a practical next step. Follow up by changing one condition or adding a constraint to test adaptability. Do not reward purely ideal answers that ignore real-world limits.",
  },
  {
    key: "motivational",
    label: "Motivational",
    promptInstructions:
      "Focus on motivation, fit, goals, and role/company interest. Ask questions about why this role, why this company, career direction, what energizes the candidate, what they are looking for next, and how their background connects to the opportunity. Listen for specificity, authenticity, realistic expectations, and a clear bridge between the candidate's experience and the target role. Follow up on generic answers by asking what specifically attracts them, what tradeoffs they understand, and why now. Do not let the candidate rely only on flattery or generic enthusiasm.",
  },
];

export const interviewStyles: InterviewStyle[] = [
  {
    description: "Supportive, warm, and encouraging.",
    key: "friendly",
    label: "Friendly",
    promptInstructions:
      "Use a warm, supportive interviewer tone while still keeping the practice useful. Acknowledge what is working in the candidate's answer before offering a concrete improvement. Ask follow-ups gently and frame retries as a chance to make the answer stronger. Keep pressure low, but do not become vague, overly reassuring, or avoidant of real feedback. The candidate should feel encouraged and clear on what to improve.",
  },
  {
    description: "Professional and balanced.",
    key: "neutral",
    label: "Neutral",
    promptInstructions:
      "Use a calm, professional interviewer tone. Keep questions realistic, direct, and even-handed. Give measured feedback that names both what worked and what needs improvement without exaggerated praise or extra pressure. Follow up when an answer is incomplete, vague, or off target, but keep the interaction steady and businesslike. The candidate should feel like they are in a normal professional interview.",
  },
  {
    description: "Direct, skeptical, and higher pressure.",
    key: "tough",
    label: "Tough",
    promptInstructions:
      "Use a direct, higher-pressure interviewer tone while staying professional and fair. Challenge vague claims, missing evidence, weak logic, overgeneralized motivation, and unsupported impact. Ask sharper follow-ups such as 'What specifically did you do?', 'How do you know that worked?', or 'Why should that matter for this role?' Keep responses concise and do not soften every critique. Do not insult, badger, or become hostile; the pressure should feel like a rigorous interview, not a personal attack.",
  },
];

export const fallbackInterviewCatalog: InterviewCatalog = {
  interviewStyles,
  practiceModes,
  questionTypes,
};
