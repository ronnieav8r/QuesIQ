import type { StoryBuilderTurn, StoryOutline } from "@/product/interview-types";
import { parseStoryOutline } from "@/product/story-lab";

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

function model() {
  return process.env.OPENAI_STORY_MODEL || process.env.OPENAI_EVALUATION_MODEL || "gpt-5.4-mini";
}

function transcript(turns: StoryBuilderTurn[]) {
  return turns.map((turn) => `${turn.role === "assistant" ? "Que" : "User"}: ${turn.text}`).join("\n");
}

export async function generateStoryFollowUp(turns: StoryBuilderTurn[]) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: [
        {
          content:
            "You are Que, helping a job seeker turn a raw experience into a reusable interview story. Ask exactly one warm, specific follow-up question. Prefer missing stakes, personal action, measurable result, or reflection. Do not outline the story yet.",
          role: "system",
        },
        {
          content: transcript(turns),
          role: "user",
        },
      ],
      max_output_tokens: 120,
      model: model(),
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
  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: [
        {
          content:
            "You are Que, an interview coach. Convert this raw story-building conversation into a reusable behavioral interview story asset. Preserve the user's authentic facts. Do not invent metrics; say the result plainly if no metric was provided. Make the outline practical for spoken practice.",
          role: "system",
        },
        {
          content: transcript(turns),
          role: "user",
        },
      ],
      max_output_tokens: 1200,
      model: model(),
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
