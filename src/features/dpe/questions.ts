export type DpeQuestion = {
  id: string;
  certificateType: {
    id: string;
    code: string;
    title: string;
  } | null;
  contentVersion: {
    id: string;
    version: number;
    status: string;
    title: string;
  } | null;
  acsTitle: string;
  acsArea: string;
  acsTask: string;
  acsElementType: string;
  acsElementReference: string;
  active: boolean;
  aiContext: string | null;
  difficulty: string | null;
  keywords: string | null;
  primarySubject: string | null;
  questionMode: string;
  questionText: string;
  visualImage: string | null;
  taskKey: string;
  taskTitle: string;
  acsPath: string;
  promptType: "recall" | "explain" | "scenario" | "oral";
  practiceLane: "oral" | "visual";
  supportsHandsFree: boolean;
  answerKeyStatus: "provisional" | "pending" | "placeholder";
  provisionalAnswerKey: string;
  answerKey: {
    status: string;
    correctAnswerElements: string[];
    acceptableVariations: string[];
    commonMisses: string[];
    sourceReferences: string[];
    notes: string | null;
  } | null;
  scoringRubric: {
    knowledge: string;
    riskManagement: string;
    scenarioJudgment: string;
    communication: string;
    checkrideReadiness: string;
  };
  rubric: {
    status: string;
    scoringNotes: string | null;
  } | null;
};

export type QuestionApiResponse = {
  available: boolean;
  questions: DpeQuestion[];
  areas: string[];
  tasksByArea: Record<string, string[]>;
  countsByArea: Record<string, number>;
};

export const areaLabels: Record<string, string> = {
  I: "Preflight Preparation",
  II: "Preflight Procedures",
  III: "Airport Operations",
  IV: "Takeoffs, Landings, and Go-Arounds",
  V: "Performance and Ground Reference Maneuvers",
  VI: "Navigation",
  VII: "Slow Flight and Stalls",
  VIII: "Basic Instrument Maneuvers",
  IX: "Emergency Operations",
  X: "Night Operations",
  XI: "Postflight Procedures"
};

export function buildEmptyQuestionResponse(): QuestionApiResponse {
  return {
    available: false,
    questions: [],
    areas: ["I"],
    tasksByArea: { I: ["A"] },
    countsByArea: { I: 0 }
  };
}
