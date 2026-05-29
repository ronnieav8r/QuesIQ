import pdfParse from "pdf-parse";

import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";

export type StudyParsedCardDraft = {
  answer: string;
  hint?: string;
  question: string;
};

const PARSE_PROMPT = `Extract flashcard question-and-answer pairs from the provided content.

Return ONLY a JSON array:
[
  {
    "question": "Clear, specific question that tests one concept",
    "answer": "Concise but complete answer",
    "hint": "Optional memory aid (omit if not useful)"
  }
]

Guidelines:
- Aim for 10-30 cards depending on content density
- Each question should have exactly one clear correct answer
- Keep answers concise
- Include hint only when useful
- Prioritize the most important and testable concepts`;

function buildPrompt(focusHint?: string) {
  return focusHint ? `${PARSE_PROMPT}\n\nFocus specifically on: ${focusHint}` : PARSE_PROMPT;
}

function extractCards(raw: string): StudyParsedCardDraft[] {
  const jsonStr = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("Que could not parse a response. Please try again.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Unexpected response from Que. Please try again.");
  }

  return parsed
    .filter(
      (item): item is { answer: string; hint?: string; question: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).question === "string" &&
        typeof (item as Record<string, unknown>).answer === "string",
    )
    .map((item) => ({
      answer: item.answer.trim(),
      hint: typeof item.hint === "string" && item.hint.trim() ? item.hint.trim() : undefined,
      question: item.question.trim(),
    }));
}

function extractTextFromHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function runStudyImportAi(args: {
  input:
    | string
    | Array<{ image_url?: { url: string }; type: "image_url" | "text"; text?: string }>;
  mode: "text" | "vision";
  prompt: string;
  rawJson: Record<string, unknown>;
  userId: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_REALTIME_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI key is not configured.");
  }
  const run = await startAiRun({
    model: "gpt-4o",
    rawJson: args.rawJson,
    runType: "study_import",
    userId: args.userId,
  });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      body: JSON.stringify({
      max_tokens: 4096,
      messages: [
        {
          content:
            args.mode === "text"
              ? `${args.input}\n\n---\n\n${args.prompt}`
              : args.input,
          role: "user",
        },
      ],
      model: "gpt-4o",
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
      id?: string;
      usage?: {
        completion_tokens?: number;
        prompt_tokens?: number;
        total_tokens?: number;
      };
    };
    if (!response.ok) {
      throw new Error(payload.error?.message || "Study import call failed.");
    }
    const text = payload.choices?.[0]?.message?.content ?? "";
    await completeAiRun(run.id, {
      costSource: payload.usage ? "exact" : "unavailable",
      inputTokens: payload.usage?.prompt_tokens,
      outputTokens: payload.usage?.completion_tokens,
      providerRequestId: payload.id,
      rawJson: {
        usage: payload.usage,
      },
      status: "succeeded",
      totalTokens: payload.usage?.total_tokens,
    });

    return text;
  } catch (error) {
    await completeAiRun(run.id, {
      errorMessage: error instanceof Error ? error.message : "Study import call failed.",
      status: "failed",
    });
    throw error;
  }
}

export async function parseTextToStudyCards(args: {
  focusHint?: string;
  text: string;
  userId: string;
}) {
  const cleaned = args.text.trim();
  if (!cleaned) {
    throw new Error("No text provided.");
  }
  const raw = await runStudyImportAi({
    input: cleaned,
    mode: "text",
    prompt: buildPrompt(args.focusHint),
    rawJson: {
      focusHint: args.focusHint ?? null,
      inputType: "text",
      textLength: cleaned.length,
    },
    userId: args.userId,
  });
  return extractCards(raw);
}

export async function parseContentToStudyCards(args: {
  file: File;
  focusHint?: string;
  userId: string;
}) {
  const prompt = buildPrompt(args.focusHint);
  const bytes = await args.file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  if (args.file.type === "application/pdf") {
    const parsed = await pdfParse(buffer);
    const text = parsed.text?.trim();
    if (!text) {
      throw new Error("Could not extract text from this PDF. Try image upload for scanned pages.");
    }
    const raw = await runStudyImportAi({
      input: text,
      mode: "text",
      prompt,
      rawJson: {
        fileType: args.file.type,
        focusHint: args.focusHint ?? null,
        inputType: "pdf",
        textLength: text.length,
      },
      userId: args.userId,
    });
    return extractCards(raw);
  }

  if (args.file.type.startsWith("image/")) {
    const base64 = buffer.toString("base64");
    const raw = await runStudyImportAi({
      input: [
        {
          image_url: { url: `data:${args.file.type};base64,${base64}` },
          type: "image_url",
        },
        {
          text: prompt,
          type: "text",
        },
      ],
      mode: "vision",
      prompt,
      rawJson: {
        fileType: args.file.type,
        focusHint: args.focusHint ?? null,
        inputType: "image",
      },
      userId: args.userId,
    });
    return extractCards(raw);
  }

  const text = buffer.toString("utf-8");
  const raw = await runStudyImportAi({
    input: text,
    mode: "text",
    prompt,
    rawJson: {
      fileType: args.file.type,
      focusHint: args.focusHint ?? null,
      inputType: "text_file",
      textLength: text.length,
    },
    userId: args.userId,
  });
  return extractCards(raw);
}

export async function parseMultipleUrlsToStudyCards(args: {
  focusHint?: string;
  urls: string[];
  userId: string;
}) {
  const failedUrls: string[] = [];
  const textParts: string[] = [];

  for (const url of args.urls) {
    let html: string;
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "Mozilla/5.0 (compatible; QuesIQ-Study/1.0)",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      html = await response.text();
    } catch {
      failedUrls.push(url);
      continue;
    }

    const text = extractTextFromHtml(html);
    if (text.length < 150) {
      failedUrls.push(url);
      continue;
    }
    textParts.push(`--- Source: ${url} ---\n${text}`);
  }

  if (textParts.length === 0) {
    throw new Error("Could not retrieve readable content from any provided URLs.");
  }

  const combined = textParts.join("\n\n").slice(0, 50_000);
  const raw = await runStudyImportAi({
    input: combined,
    mode: "text",
    prompt: buildPrompt(args.focusHint),
    rawJson: {
      failedCount: failedUrls.length,
      focusHint: args.focusHint ?? null,
      inputType: "urls",
      successCount: textParts.length,
      totalUrls: args.urls.length,
    },
    userId: args.userId,
  });

  return {
    cards: extractCards(raw),
    failedUrls,
  };
}
