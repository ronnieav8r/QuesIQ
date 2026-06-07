import type { DpeQuestion } from "./questions";

type DpeQuestionAssetInput = DpeQuestion["assets"][number];

type QuestionWithContent = {
  active: boolean;
  acsArea: string;
  acsElementReference: string;
  acsElementType: string;
  acsTask: string;
  acsTitle: string;
  aiContext: string | null;
  answerKey?: {
    acceptableVariations: string[] | null;
    commonMisses: string[] | null;
    correctAnswerElements: string[];
    notes: string | null;
    sourceReferences: string[] | null;
    status: string;
  } | null;
  certificateType?: {
    code: string;
    id: string;
    title: string;
  } | null;
  contentVersion?: {
    id: string;
    status: string;
    title: string;
    version: number;
  } | null;
  difficulty: string | null;
  id: string;
  keywords: string | null;
  primarySubject: string | null;
  questionMode: string;
  questionText: string;
  rubric?: {
    checkrideReadiness: string;
    communication: string;
    knowledge: string;
    riskManagement: string;
    scenarioJudgment: string;
    scoringNotes: string | null;
    status: string;
  } | null;
  visualImage: string | null;
  assets?: DpeQuestionAssetInput[];
};

type StoredAiContext = {
  answerKeyStatus?: "provisional" | "pending" | "placeholder";
  practiceLane?: DpeQuestion["practiceLane"];
  promptType?: DpeQuestion["promptType"];
  provisionalAnswerKey?: string;
  scoringRubric?: DpeQuestion["scoringRubric"];
  supportsHandsFree?: boolean;
  taskTitle?: string;
};

const taskLabels: Record<string, string> = {
  "I.A": "Pilot Qualifications",
  "I.B": "Airworthiness Requirements",
  "I.C": "Weather Information",
  "I.D": "Cross-Country Flight Planning",
  "I.E": "National Airspace System",
};

const defaultRubric: DpeQuestion["scoringRubric"] = {
  checkrideReadiness:
    "Evaluate whether the response would likely satisfy the selected oral checkride target standard.",
  communication:
    "Evaluate clarity, organization, confidence, and whether a DPE could follow the answer.",
  knowledge:
    "Evaluate factual accuracy, completeness, and whether the applicant directly answers the ACS-linked prompt.",
  riskManagement:
    "Evaluate hazard recognition, mitigations, and conservative aeronautical decision-making when relevant.",
  scenarioJudgment: "Evaluate practical application to a realistic checkride or flight scenario.",
};

function parseAiContext(value: string | null): StoredAiContext {
  if (!value) return {};

  try {
    return JSON.parse(value) as StoredAiContext;
  } catch {
    return {
      answerKeyStatus: "provisional",
      provisionalAnswerKey: value,
    };
  }
}

function inferPromptType(questionText: string): DpeQuestion["promptType"] {
  const text = questionText.toLowerCase();
  if (text.startsWith("what ") || text.startsWith("when ") || text.startsWith("who ")) {
    return "recall";
  }
  if (text.startsWith("why ") || text.startsWith("how ")) {
    return "explain";
  }
  if (text.includes("would you") || text.includes("scenario") || text.includes("you are")) {
    return "scenario";
  }
  return "oral";
}

function normalizeAnswerKeyStatus(value: string): DpeQuestion["answerKeyStatus"] {
  if (value === "provisional" || value === "placeholder" || value === "pending") {
    return value;
  }
  return "pending";
}

export function formatQuestion(question: QuestionWithContent): DpeQuestion {
  const context = parseAiContext(question.aiContext);
  const taskKey = `${question.acsArea}.${question.acsTask}`;
  const taskTitle = context.taskTitle ?? taskLabels[taskKey] ?? `Task ${question.acsTask}`;
  const practiceLane = context.practiceLane ?? (question.visualImage ? "visual" : "oral");
  const assets =
    question.assets && question.assets.length > 0
      ? question.assets
      : question.visualImage
        ? [
            {
              id: `${question.id}:legacy-visual-image`,
              instructions: "Legacy visual prompt image migrated into the DPE asset contract.",
              label: "Visual prompt",
              metadata: { source: "legacy_visualImage" },
              sortOrder: 0,
              storageKey: null,
              transcript: null,
              type: "image" as const,
              url: question.visualImage,
            },
          ]
        : [];

  return {
    acsArea: question.acsArea,
    acsElementReference: question.acsElementReference,
    acsElementType: question.acsElementType,
    acsPath: `Area ${question.acsArea} / ${taskTitle} / ${question.acsElementReference}`,
    acsTask: question.acsTask,
    acsTitle: question.acsTitle,
    active: question.active,
    aiContext: question.aiContext,
    answerKey: question.answerKey
      ? {
          acceptableVariations: question.answerKey.acceptableVariations ?? [],
          commonMisses: question.answerKey.commonMisses ?? [],
          correctAnswerElements: question.answerKey.correctAnswerElements,
          notes: question.answerKey.notes,
          sourceReferences: question.answerKey.sourceReferences ?? [],
          status: question.answerKey.status,
        }
      : null,
    answerKeyStatus: normalizeAnswerKeyStatus(
      question.answerKey?.status ?? context.answerKeyStatus ?? "pending",
    ),
    assets,
    certificateType: question.certificateType
      ? {
          code: question.certificateType.code,
          id: question.certificateType.id,
          title: question.certificateType.title,
        }
      : null,
    contentVersion: question.contentVersion
      ? {
          id: question.contentVersion.id,
          status: question.contentVersion.status,
          title: question.contentVersion.title,
          version: question.contentVersion.version,
        }
      : null,
    difficulty: question.difficulty,
    id: question.id,
    keywords: question.keywords,
    practiceLane,
    primarySubject: question.primarySubject,
    promptType: context.promptType ?? inferPromptType(question.questionText),
    provisionalAnswerKey:
      question.answerKey?.correctAnswerElements[0] ??
      context.provisionalAnswerKey ??
      "Placeholder question only. Final expected answer elements have not been authored yet.",
    questionMode: question.questionMode,
    questionText: question.questionText,
    rubric: question.rubric
      ? {
          scoringNotes: question.rubric.scoringNotes,
          status: question.rubric.status,
        }
      : null,
    scoringRubric: question.rubric
      ? {
          checkrideReadiness: question.rubric.checkrideReadiness,
          communication: question.rubric.communication,
          knowledge: question.rubric.knowledge,
          riskManagement: question.rubric.riskManagement,
          scenarioJudgment: question.rubric.scenarioJudgment,
        }
      : context.scoringRubric ?? defaultRubric,
    supportsHandsFree: context.supportsHandsFree ?? practiceLane === "oral",
    taskKey,
    taskTitle,
    visualImage: question.visualImage,
  };
}
