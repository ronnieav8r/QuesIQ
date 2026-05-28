import type { IntroAudience, IntroLength } from "@/product/interview-types";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";

export type IntroductionDraftResult = {
  background: string;
  proofPoint: string;
  roleInterest: string;
  script: string;
  strength: string;
  title: string;
  transition: string;
};

type IntroductionDraftInput = {
  audience: IntroAudience;
  jobDescription?: string;
  length: IntroLength;
  rawNotes: string;
  targetCompany?: string;
  targetRole?: string;
};

type ResponsesApiBody = {
  error?: {
    message?: string;
  };
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
  output_text?: string;
};

const introductionDraftSchema = {
  additionalProperties: false,
  properties: {
    background: { type: "string" },
    proofPoint: { type: "string" },
    roleInterest: { type: "string" },
    script: { type: "string" },
    strength: { type: "string" },
    title: { type: "string" },
    transition: { type: "string" },
  },
  required: [
    "title",
    "background",
    "strength",
    "proofPoint",
    "roleInterest",
    "transition",
    "script",
  ],
  type: "object",
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function extractResponseText(body: ResponsesApiBody) {
  if (body.output_text) {
    return body.output_text;
  }

  return body.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter(Boolean)
    .join("\n");
}

function parseIntroductionDraft(value: unknown): IntroductionDraftResult | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const draft = {
    background: clean(candidate.background),
    proofPoint: clean(candidate.proofPoint),
    roleInterest: clean(candidate.roleInterest),
    script: clean(candidate.script),
    strength: clean(candidate.strength),
    title: clean(candidate.title),
    transition: clean(candidate.transition),
  };

  if (!draft.script || !draft.title) {
    return undefined;
  }

  return draft;
}

function lengthGuidance(length: IntroLength) {
  if (length === "short") {
    return "30 to 45 seconds, crisp enough for a recruiter phone screen.";
  }

  if (length === "long") {
    return "90 to 120 seconds, with enough detail for an in-person or panel opening.";
  }

  return "60 to 90 seconds, suitable for most virtual or hiring-manager interviews.";
}

function audienceGuidance(audience: IntroAudience) {
  if (audience === "hr_phone") {
    return "early recruiter or HR phone screen";
  }

  if (audience === "in_person") {
    return "in-person interview, panel, or senior stakeholder conversation";
  }

  return "virtual interview or hiring-manager opening";
}

export async function generateIntroductionDraft(
  input: IntroductionDraftInput,
): Promise<IntroductionDraftResult> {
  const promptConfig = await getActivePromptConfig("introduction_draft");
  const context = [
    `Requested length: ${lengthGuidance(input.length)}`,
    `Audience: ${audienceGuidance(input.audience)}`,
    input.targetRole ? `Target role: ${input.targetRole}` : undefined,
    input.targetCompany ? `Target company: ${input.targetCompany}` : undefined,
    input.jobDescription ? `Job description/context: ${input.jobDescription}` : undefined,
    "Raw introduction material:",
    input.rawNotes,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: [
        {
          content: promptConfig.instructions,
          role: "system",
        },
        {
          content: context,
          role: "user",
        },
      ],
      max_output_tokens: 1000,
      model: promptConfig.model,
      text: {
        format: {
          name: "quesiq_introduction_draft",
          schema: introductionDraftSchema,
          strict: true,
          type: "json_schema",
        },
      },
    }),
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const body = (await response.json()) as ResponsesApiBody;

  if (!response.ok) {
    throw new Error(body.error?.message || "Introduction draft could not be generated.");
  }

  const text = extractResponseText(body);
  const draft = text ? parseIntroductionDraft(JSON.parse(text)) : undefined;

  if (!draft) {
    throw new Error("Introduction draft did not match the expected shape.");
  }

  return draft;
}
