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
  answerKeyStatus: "draft" | "missing" | "placeholder" | "provisional" | "ready" | "review" | "published" | "verified" | "pending";
  assets: DpeQuestionAsset[];
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

export type DpeQuestionAsset = {
  id: string;
  type: "audio" | "chart" | "document" | "image" | "other";
  label: string;
  url: string | null;
  storageKey: string | null;
  transcript: string | null;
  instructions: string | null;
  sortOrder: number;
  metadata: Record<string, unknown> | null;
};

export type DpeAnswerVerdict = "below_standard" | "meets_standard" | "partial";

export type DpeAnswerEvaluation = {
  verdict: DpeAnswerVerdict;
  knowledgeGaps: string[];
  tightenUpAdvice: string[];
  safetyOrRiskNotes: string[];
  referenceAnswerElementsMatched: string[];
  missingAnswerElements: string[];
  confidence: number;
};

export type DpeAnswerAttempt = {
  id?: string;
  attemptNumber?: number;
  transcriptText: string;
  transcriptSource: "audio_transcription" | "typed_dev_recovery";
  submittedAt: string;
  evaluation: DpeAnswerEvaluation;
  evaluatorPromptKey: string;
  evaluatorPromptVersion: number;
  evaluatorModel: string | null;
  aiRunId?: string | null;
};

export type QuestionApiResponse = {
  available: boolean;
  certificateTypes: {
    code: string;
    id: string;
    questionCount: number;
    title: string;
  }[];
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
    certificateTypes: [],
    questions: [],
    areas: ["I"],
    tasksByArea: { I: ["A"] },
    countsByArea: { I: 0 }
  };
}
