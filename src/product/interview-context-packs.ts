import type { PracticeModeKey, QuestionTypeKey } from "@/product/interview-types";

export type InterviewContextPackScope = "company" | "industry" | "role_family";

export type InterviewContextPackStatus = "archived" | "draft" | "published";

export type InterviewContextPackFreshness = "evergreen" | "review_due" | "stale";

export type InterviewContextPackSignal = {
  label: string;
  summary: string;
  sourceNote?: string;
};

export type InterviewContextPackQuestionSeed = {
  difficulty?: "beginner" | "standard" | "advanced";
  modeKeys?: PracticeModeKey[];
  questionText: string;
  questionTypeKey?: QuestionTypeKey;
  rationale: string;
  targetSkill: string;
};

export type InterviewContextPackStoryHint = {
  prompt: string;
  storyCategories: string[];
  targetSkill: string;
};

export type InterviewContextPackRubricHint = {
  dimension: "authenticity" | "clarity" | "confidence" | "impact" | "relevance";
  positiveSignals: string[];
  riskSignals: string[];
};

export type InterviewContextPackSummary = {
  commonSignals: InterviewContextPackSignal[];
  evaluationHints: InterviewContextPackRubricHint[];
  questionSeeds: InterviewContextPackQuestionSeed[];
  storyHints: InterviewContextPackStoryHint[];
};

export type InterviewContextPack = {
  createdAt: string;
  description: string;
  employerName?: string;
  id: string;
  industryKey?: string;
  key: string;
  lastReviewedAt?: string;
  ownerNote?: string;
  publishedAt?: string;
  roleFamilyKey?: string;
  scope: InterviewContextPackScope;
  status: InterviewContextPackStatus;
  summary: InterviewContextPackSummary;
  title: string;
  updatedAt: string;
  version: number;
};

export type InterviewContextPackMatchReason =
  | "admin_pinned"
  | "employer_match"
  | "industry_match"
  | "job_description_match"
  | "resume_summary_match"
  | "role_family_match";

export type InterviewContextPackSelection = {
  freshness: InterviewContextPackFreshness;
  matchReasons: InterviewContextPackMatchReason[];
  pack: InterviewContextPack;
  rank: number;
  score: number;
};

export type InterviewContextPackPromptSnippet = {
  citationsRequired: boolean;
  content: string;
  packKey: string;
  packScope: InterviewContextPackScope;
  packVersion: number;
};
