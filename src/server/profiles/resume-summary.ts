import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import type { InterviewResumeSummary } from "@/product/interview-types";
import { parseInterviewResumeSummary } from "@/product/resume-summary";
import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { getOpenAiApiKey } from "@/server/openai/keys";
import {
  estimateTokenCostMicroUsd,
  getActiveAiPricing,
} from "@/server/pricing/ai-pricing";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";

export const resumeSummaryVersion = 1;

type ResponsesApiBody = {
  error?: {
    message?: string;
  };
  id?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

export type ResumeSummaryResult = {
  sourceHash?: string;
  summary?: InterviewResumeSummary;
  unavailableReason?: string;
};

type ResumeSummaryInput = {
  resumeName?: string;
  resumeParsedAt?: string;
  resumeText?: string;
  userId: string;
};

const resumeSummarySchema = {
  additionalProperties: false,
  properties: {
    currentOrRecentRole: { type: "string" },
    gapsOrAreasToProbe: {
      items: { type: "string" },
      type: "array",
    },
    generatedAt: { type: "string" },
    keySkills: {
      items: { type: "string" },
      type: "array",
    },
    likelyBehavioralStories: {
      items: {
        additionalProperties: false,
        properties: {
          evidence: { type: "string" },
          likelyQuestionTypes: {
            items: { type: "string" },
            type: "array",
          },
          starElementHints: {
            additionalProperties: false,
            properties: {
              action: { type: "string" },
              result: { type: "string" },
              situation: { type: "string" },
              task: { type: "string" },
            },
            required: ["situation", "task", "action", "result"],
            type: "object",
          },
          title: { type: "string" },
        },
        required: ["title", "evidence", "likelyQuestionTypes", "starElementHints"],
        type: "object",
      },
      type: "array",
    },
    quantifiedWins: {
      items: { type: "string" },
      type: "array",
    },
    relevantIndustries: {
      items: { type: "string" },
      type: "array",
    },
    sourceResumeName: { type: "string" },
    sourceResumeParsedAt: { type: "string" },
    strongestExperience: {
      items: { type: "string" },
      type: "array",
    },
    targetCompany: { type: "string" },
    targetRole: { type: "string" },
    targetRoleAlignment: { type: "string" },
  },
  required: [
    "currentOrRecentRole",
    "targetRoleAlignment",
    "relevantIndustries",
    "strongestExperience",
    "keySkills",
    "quantifiedWins",
    "likelyBehavioralStories",
    "gapsOrAreasToProbe",
    "generatedAt",
    "sourceResumeName",
    "sourceResumeParsedAt",
    "targetRole",
    "targetCompany",
  ],
  type: "object",
};

function extractResponseText(body: ResponsesApiBody) {
  return (
    body.output_text ||
    body.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n")
  );
}

export function getResumeSummarySourceHash(input: Omit<ResumeSummaryInput, "userId">) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        resumeText: input.resumeText || "",
        resumeSummaryVersion,
      }),
    )
    .digest("hex");
}

function buildResumeSummaryInput(input: ResumeSummaryInput) {
  return {
    resumeName: input.resumeName || "",
    resumeParsedAt: input.resumeParsedAt || "",
    resumeText: input.resumeText || "",
    targetCompany: "",
    targetRole: "",
  };
}

export async function getOrCreateInterviewResumeSummary(
  input: ResumeSummaryInput,
): Promise<ResumeSummaryResult> {
  const resumeText = input.resumeText?.trim();

  if (!resumeText) {
    return { unavailableReason: "missing_resume_text" };
  }

  const sourceHash = getResumeSummarySourceHash(input);
  const [profile] = await getDb()
    .select({
      resumeSummary: profiles.resumeSummary,
      resumeSummarySourceHash: profiles.resumeSummarySourceHash,
      resumeSummaryVersion: profiles.resumeSummaryVersion,
    })
    .from(profiles)
    .where(eq(profiles.userId, input.userId))
    .limit(1);
  const existingSummary = parseInterviewResumeSummary(profile?.resumeSummary);

  if (
    existingSummary &&
    profile?.resumeSummarySourceHash === sourceHash &&
    profile.resumeSummaryVersion === resumeSummaryVersion
  ) {
    return { sourceHash, summary: existingSummary };
  }

  const apiKey = getOpenAiApiKey("interview");

  if (!apiKey) {
    return { sourceHash, unavailableReason: "missing_openai_key" };
  }

  const promptConfig = await getActivePromptConfig("resume_summary");
  const pricing = await getActiveAiPricing(promptConfig.model, "text");
  const aiRun = await startAiRun({
    model: promptConfig.model,
    promptConfigId: promptConfig.id,
    promptConfigKey: promptConfig.key,
    promptConfigVersion: promptConfig.version,
    promptSnapshot: promptConfig.instructions,
    rawJson: {
      resumeCharacters: resumeText.length,
      resumeSummarySourceHash: sourceHash,
      resumeSummaryVersion,
      schema: "quesiq_interview_resume_summary",
    },
    runType: "resume_summary",
    userId: input.userId,
  });

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            content: promptConfig.instructions,
            role: "system",
          },
          {
            content: JSON.stringify(buildResumeSummaryInput(input)),
            role: "user",
          },
        ],
        max_output_tokens: 1800,
        model: promptConfig.model,
        reasoning: { effort: "low" },
        text: {
          format: {
            name: "quesiq_interview_resume_summary",
            schema: resumeSummarySchema,
            strict: true,
            type: "json_schema",
          },
        },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const body = (await response.json()) as ResponsesApiBody;

    if (!response.ok) {
      throw new Error(body.error?.message || "Resume summary could not be generated.");
    }

    const text = extractResponseText(body);
    const summary = text ? parseInterviewResumeSummary(JSON.parse(text)) : undefined;

    if (!summary) {
      throw new Error("Resume summary did not match the expected shape.");
    }

    const now = new Date();
    const stampedSummary = {
      ...summary,
      generatedAt: now.toISOString(),
      sourceResumeName: input.resumeName || summary.sourceResumeName,
      sourceResumeParsedAt: input.resumeParsedAt || summary.sourceResumeParsedAt,
      targetCompany: summary.targetCompany,
      targetRole: summary.targetRole,
    };

    await getDb()
      .update(profiles)
      .set({
        resumeSummary: stampedSummary,
        resumeSummaryGeneratedAt: now,
        resumeSummarySourceHash: sourceHash,
        resumeSummaryVersion,
        updatedAt: now,
      })
      .where(eq(profiles.userId, input.userId));

    await completeAiRun(aiRun.id, {
      costSource: body.usage ? "exact" : "unavailable",
      estimatedCostMicroUsd: estimateTokenCostMicroUsd(
        pricing,
        body.usage?.input_tokens,
        body.usage?.output_tokens,
      ),
      inputTokens: body.usage?.input_tokens,
      outputTokens: body.usage?.output_tokens,
      providerRequestId: body.id,
      rawJson: {
        providerRequestId: body.id,
        resumeSummarySourceHash: sourceHash,
        resumeSummaryVersion,
        schema: "quesiq_interview_resume_summary",
        usage: body.usage,
      },
      status: "succeeded",
      totalTokens: body.usage?.total_tokens,
    });

    return { sourceHash, summary: stampedSummary };
  } catch (error) {
    await completeAiRun(aiRun.id, {
      errorMessage:
        error instanceof Error ? error.message : "Resume summary could not be generated.",
      rawJson: {
        resumeSummarySourceHash: sourceHash,
        resumeSummaryVersion,
      },
      status: "failed",
    });

    return {
      sourceHash,
      unavailableReason:
        error instanceof Error ? error.message : "resume_summary_generation_failed",
    };
  }
}
