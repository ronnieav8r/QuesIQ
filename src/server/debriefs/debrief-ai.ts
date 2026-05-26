import type {
  SessionDebriefResult,
  SessionEvaluationResult,
  SessionHistoryItem,
  VoiceTranscriptTurn,
} from "@/product/interview-types";
import { parseSessionDebriefResult } from "@/product/debrief";
import type { PromptConfigRecord } from "@/product/interview-types";

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

const debriefSchema = {
  additionalProperties: false,
  properties: {
    focusAreas: {
      items: { type: "string" },
      maxItems: 4,
      type: "array",
    },
    followUpQuestion: { type: "string" },
    practicePlan: {
      items: { type: "string" },
      maxItems: 4,
      type: "array",
    },
    strengths: {
      items: { type: "string" },
      maxItems: 4,
      type: "array",
    },
    summary: { type: "string" },
  },
  required: ["summary", "strengths", "focusAreas", "practicePlan", "followUpQuestion"],
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

function formatEvaluation(evaluation?: SessionEvaluationResult) {
  if (!evaluation) {
    return "No completed review is available.";
  }

  return [
    `Summary: ${evaluation.summary}`,
    `Coach note: ${evaluation.coachingInsight}`,
    `Next action: ${evaluation.nextAction}`,
    "Scores:",
    ...evaluation.scores.map(
      (score) => `- ${score.label}: ${score.score}/5 - ${score.summary}`,
    ),
  ].join("\n");
}

function formatTranscript(transcript: VoiceTranscriptTurn[]) {
  return transcript
    .map((turn) => `${turn.speaker}: ${turn.text}`)
    .join("\n")
    .slice(0, 16000);
}

export async function generateSessionDebrief({
  promptConfig,
  session,
  userNote,
}: {
  promptConfig: PromptConfigRecord;
  session: SessionHistoryItem;
  userNote: string;
}): Promise<SessionDebriefResult> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: [
        {
          content: promptConfig.instructions,
          role: "system",
        },
        {
          content: [
            `Target role: ${session.targetRole}`,
            `Target company: ${session.targetCompany || "Not provided"}`,
            `Mode: ${session.modeKey}`,
            `Question focus: ${session.questionTypeKey || "Not provided"}`,
            `Style: ${session.styleKey}`,
            `Candidate debrief note or question: ${userNote || "Help me understand this session and what to practice next."}`,
            "",
            "Saved practice review:",
            formatEvaluation(session.evaluation),
            "",
            "Transcript:",
            formatTranscript(session.transcript),
          ].join("\n"),
          role: "user",
        },
      ],
      max_output_tokens: 1100,
      model: promptConfig.model,
      text: {
        format: {
          name: "quesiq_session_debrief",
          schema: debriefSchema,
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
    throw new Error(body.error?.message || "Session debrief could not be generated.");
  }

  const text = extractResponseText(body);
  const debrief = text ? parseSessionDebriefResult(JSON.parse(text)) : undefined;

  if (!debrief) {
    throw new Error("Session debrief did not match the expected shape.");
  }

  return debrief;
}
