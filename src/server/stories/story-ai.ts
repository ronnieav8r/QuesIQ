import type { StoryBuilderTurn, StoryOutline } from "@/product/interview-types";
import { parseStoryOutline } from "@/product/story-lab";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";

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

const storyOutlineSchema = {
  additionalProperties: false,
  properties: {
    actions: {
      items: { type: "string" },
      maxItems: 6,
      type: "array",
    },
    alternateSpins: {
      items: {
        additionalProperties: false,
        properties: {
          angle: { type: "string" },
          question: { type: "string" },
          whyItWorks: { type: "string" },
        },
        required: ["angle", "question", "whyItWorks"],
        type: "object",
      },
      maxItems: 5,
      type: "array",
    },
    categories: {
      items: {
        enum: [
          "adaptability",
          "ambiguity",
          "communication",
          "conflict",
          "customer_impact",
          "failure",
          "leadership",
          "learning",
          "ownership",
          "problem_solving",
          "teamwork",
          "time_management",
        ],
        type: "string",
      },
      maxItems: 5,
      type: "array",
    },
    coachNotes: {
      items: { type: "string" },
      maxItems: 6,
      type: "array",
    },
    practicePrompt: { type: "string" },
    result: { type: "string" },
    situation: { type: "string" },
    summary: { type: "string" },
    task: { type: "string" },
    title: { type: "string" },
  },
  required: [
    "title",
    "summary",
    "situation",
    "task",
    "actions",
    "result",
    "practicePrompt",
    "categories",
    "alternateSpins",
    "coachNotes",
  ],
  type: "object",
};

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

function transcript(turns: StoryBuilderTurn[]) {
  return turns.map((turn) => `${turn.role === "assistant" ? "Que" : "User"}: ${turn.text}`).join("\n");
}

export async function generateStoryFollowUp(turns: StoryBuilderTurn[]) {
  const promptConfig = await getActivePromptConfig("story_follow_up");
  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: [
        {
          content: promptConfig.instructions,
          role: "system",
        },
        {
          content: transcript(turns),
          role: "user",
        },
      ],
      max_output_tokens: 120,
      model: promptConfig.model,
    }),
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const body = (await response.json()) as ResponsesApiBody;

  if (!response.ok) {
    throw new Error(body.error?.message || "Story follow-up could not be generated.");
  }

  const question = extractResponseText(body)?.trim();

  if (!question) {
    throw new Error("Story follow-up response was empty.");
  }

  return question;
}

export async function generateStoryOutline(turns: StoryBuilderTurn[]): Promise<StoryOutline> {
  const promptConfig = await getActivePromptConfig("story_outline");
  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: [
        {
          content: promptConfig.instructions,
          role: "system",
        },
        {
          content: transcript(turns),
          role: "user",
        },
      ],
      max_output_tokens: 1200,
      model: promptConfig.model,
      text: {
        format: {
          name: "quesiq_story_outline",
          schema: storyOutlineSchema,
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
    throw new Error(body.error?.message || "Story outline could not be generated.");
  }

  const text = extractResponseText(body);
  const outline = text ? parseStoryOutline(JSON.parse(text)) : undefined;

  if (!outline) {
    throw new Error("Story outline did not match the expected shape.");
  }

  return outline;
}
