export type NclexPracticeMode =
  | "adaptive_readiness"
  | "category_focus"
  | "missed_question_review"
  | "ngn_case_study"
  | "weakness_remediation";

export type NclexItemType =
  | "bow_tie"
  | "dropdown_cloze"
  | "highlight"
  | "matrix"
  | "multiple_choice"
  | "multiple_response"
  | "ordered_response";

export type NclexSelectionReason =
  | "avoid_repeat_replacement"
  | "category_balance"
  | "difficulty_calibration"
  | "due_for_review"
  | "missed_question_review"
  | "weak_client_need_category"
  | "weak_clinical_judgment_step";

export type NclexQuestionOption = {
  id: string;
  label: string;
};

export type NclexQuestionView = {
  category: {
    id: string;
    title: string;
  };
  clinicalJudgmentStep?: {
    id: string;
    title: string;
  };
  concepts: string[];
  difficultyEstimate: number;
  explanation?: string;
  id: string;
  itemType: NclexItemType;
  options: NclexQuestionOption[];
  prompt: string;
  remediation?: string;
  tags: string[];
};

export type NclexAnswerResult = {
  correct: boolean;
  correctAnswer: unknown;
  explanation?: string;
  remediation?: string;
  score: number;
};

export type NclexSessionSummary = {
  answeredItems: number;
  correctItems: number;
  readinessEstimate: string;
  weakCategories: Array<{ attempts: number; correct: number; id: string; title: string }>;
  weakJudgmentSteps: Array<{ attempts: number; correct: number; id: string; title: string }>;
};
