import { and, eq } from "drizzle-orm";

import { parseSessionEvaluation } from "@/product/session-evaluation";
import type {
  SessionEvaluationResult,
  SessionSetupSnapshot,
  VoiceSessionArtifactDraft,
} from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { evaluations, sessions } from "@/server/db/schema";

type SessionEvaluationRecord = {
  id: string;
  model: string;
  result: SessionEvaluationResult;
};

type ResponsesApiBody = {
  error?: {
    message?: string;
  };
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  output_text?: string;
};

const evaluationSchema = {
  additionalProperties: false,
  properties: {
    coachingInsight: {
      type: "string",
    },
    nextAction: {
      type: "string",
    },
    scores: {
      items: {
        additionalProperties: false,
        properties: {
          key: {
            enum: ["confidence", "clarity", "relevance", "impact", "authenticity"],
            type: "string",
          },
          label: {
            type: "string",
          },
          score: {
            maximum: 5,
            minimum: 1,
            type: "integer",
          },
          summary: {
            type: "string",
          },
        },
        required: ["key", "label", "score", "summary"],
        type: "object",
      },
      maxItems: 5,
      minItems: 5,
      type: "array",
    },
    summary: {
      type: "string",
    },
  },
  required: ["summary", "coachingInsight", "nextAction", "scores"],
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

function buildEvaluationInput(
  snapshot: SessionSetupSnapshot,
  artifact: VoiceSessionArtifactDraft,
) {
  return {
    session: {
      mode: snapshot.modeKey,
      questionFocus: snapshot.questionTypeKey || "general",
      style: snapshot.styleKey,
      targetCompany: snapshot.interviewContext.targetCompany || "Optional",
      targetRole: snapshot.interviewContext.targetRole || "General practice",
    },
    transcript: artifact.transcript.map((turn) => ({
      speaker: turn.speaker,
      text: turn.text,
    })),
  };
}

async function requestEvaluation(
  snapshot: SessionSetupSnapshot,
  artifact: VoiceSessionArtifactDraft,
  model: string,
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: [
        {
          content:
            "You are Que, QuesIQ Interview's interview coach. Evaluate the candidate's spoken practice transcript. Be specific, kind, and useful. Score each dimension from 1 to 5 where 5 is strongest. Do not mention APIs or implementation details.",
          role: "system",
        },
        {
          content: JSON.stringify(buildEvaluationInput(snapshot, artifact)),
          role: "user",
        },
      ],
      max_output_tokens: 1200,
      model,
      text: {
        format: {
          name: "quesiq_session_evaluation",
          schema: evaluationSchema,
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
    throw new Error(body.error?.message || "OpenAI evaluation request failed.");
  }

  const text = extractResponseText(body);

  if (!text) {
    throw new Error("OpenAI evaluation response did not include text.");
  }

  const evaluation = parseSessionEvaluation(JSON.parse(text));

  if (!evaluation) {
    throw new Error("OpenAI evaluation response did not match the expected shape.");
  }

  return evaluation;
}

export async function createSessionEvaluation(
  sessionId: string,
  userId: string,
): Promise<SessionEvaluationRecord | undefined> {
  const [existing] = await getDb()
    .select({
      id: evaluations.id,
      model: evaluations.model,
      result: evaluations.result,
    })
    .from(evaluations)
    .where(and(eq(evaluations.sessionId, sessionId), eq(evaluations.userId, userId)))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [session] = await getDb()
    .select({
      contextSnapshot: sessions.contextSnapshot,
      id: sessions.id,
      voiceArtifact: sessions.voiceArtifact,
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!session) {
    return undefined;
  }

  if (!session.voiceArtifact?.endedAt || session.voiceArtifact.transcript.length === 0) {
    throw new Error("This practice session does not have a saved transcript yet.");
  }

  const model = process.env.OPENAI_EVALUATION_MODEL || "gpt-5.4-mini";
  const result = await requestEvaluation(session.contextSnapshot, session.voiceArtifact, model);
  const now = new Date();

  const [evaluation] = await getDb()
    .insert(evaluations)
    .values({
      model,
      result,
      sessionId,
      updatedAt: now,
      userId,
    })
    .onConflictDoUpdate({
      set: {
        model,
        result,
        updatedAt: now,
      },
      target: evaluations.sessionId,
    })
    .returning({
      id: evaluations.id,
      model: evaluations.model,
      result: evaluations.result,
    });

  await getDb()
    .update(sessions)
    .set({
      status: "evaluated",
      updatedAt: now,
    })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));

  return evaluation;
}
