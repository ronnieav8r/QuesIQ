import { and, desc, eq } from "drizzle-orm";

import type { PromptConfigRecord } from "@/product/interview-types";
import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import { getDb } from "@/server/db/client";
import {
  evaluations,
  quiraConversations,
  quiraKnowledgeArticles,
  quiraMessages,
  quiraSupportCases,
  quiraToolEvents,
  sessions,
  users,
} from "@/server/db/schema";
import { getOpenAiApiKey } from "@/server/openai/keys";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";

type QuiraProduct = "dpe" | "interview" | "shared" | "study";
type SupportCaseKind = "bug" | "feedback" | "support";
type SupportCaseUrgency = "high" | "low" | "normal";

type QuiraChatInput = {
  browserContext?: Record<string, unknown>;
  conversationId?: string;
  message: string;
  product?: string;
  screen?: string;
  sessionId?: string;
};

type QuiraChatUser = {
  email?: string | null;
  id: string;
  name?: string | null;
};

type KnowledgeArticleRecord = {
  category: string;
  content: string;
  id: string;
  product: string;
  slug: string;
  tags: string[];
  title: string;
};

type ToolEventRecord = {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: "failed" | "succeeded";
  toolName: string;
};

type ResponsesApiOutputItem = {
  arguments?: string;
  call_id?: string;
  content?: Array<{ text?: string; type?: string }>;
  name?: string;
  type?: string;
};

type ResponsesApiResponse = {
  error?: { message?: string };
  id?: string;
  output?: ResponsesApiOutputItem[];
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

const MAX_MESSAGE_LENGTH = 2000;
const MAX_SCREEN_LENGTH = 120;
const MAX_PRODUCT_LENGTH = 40;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_MESSAGES = 12;
const MAX_TOOL_ROUNDS = 2;

const globalForQuira = globalThis as typeof globalThis & {
  quiraRateLimit?: Map<string, number[]>;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function cleanProduct(value: unknown): QuiraProduct {
  const product = cleanText(value, MAX_PRODUCT_LENGTH)?.toLowerCase();

  if (product === "dpe" || product === "interview" || product === "study") {
    return product;
  }

  return "shared";
}

function cleanUuid(value: unknown) {
  const text = cleanText(value, 80);

  return text &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      text,
    )
    ? text
    : undefined;
}

function cleanBrowserContext(value: unknown) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const candidate = value as Record<string, unknown>;

  return {
    language: cleanText(candidate.language, 80),
    pathname: cleanText(candidate.pathname, 200),
    userAgent: cleanText(candidate.userAgent, 500),
    viewport: cleanText(candidate.viewport, 80),
  };
}

export function parseQuiraChatInput(body: unknown): QuiraChatInput | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const candidate = body as Record<string, unknown>;
  const message = cleanText(candidate.message, MAX_MESSAGE_LENGTH);

  if (!message) {
    return undefined;
  }

  return {
    browserContext: cleanBrowserContext(candidate.browserContext),
    conversationId: cleanUuid(candidate.conversationId),
    message,
    product: cleanProduct(candidate.product),
    screen: cleanText(candidate.screen, MAX_SCREEN_LENGTH) ?? "unknown",
    sessionId: cleanUuid(candidate.sessionId),
  };
}

export function checkQuiraRateLimit(userId: string) {
  const now = Date.now();
  const bucket = globalForQuira.quiraRateLimit ?? new Map<string, number[]>();
  globalForQuira.quiraRateLimit = bucket;

  const recent = (bucket.get(userId) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (recent.length >= RATE_LIMIT_MAX_MESSAGES) {
    return false;
  }

  recent.push(now);
  bucket.set(userId, recent);

  return true;
}

function titleFromMessage(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();

  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized || "Support chat";
}

async function getOrCreateConversation(input: QuiraChatInput, user: QuiraChatUser) {
  const now = new Date();

  if (input.conversationId) {
    const [existing] = await getDb()
      .select()
      .from(quiraConversations)
      .where(
        and(
          eq(quiraConversations.id, input.conversationId),
          eq(quiraConversations.userId, user.id),
        ),
      )
      .limit(1);

    if (existing) {
      await getDb()
        .update(quiraConversations)
        .set({
          product: input.product ?? existing.product,
          screen: input.screen ?? existing.screen,
          sessionId: input.sessionId ?? existing.sessionId,
          updatedAt: now,
        })
        .where(eq(quiraConversations.id, existing.id));

      return existing;
    }
  }

  const [created] = await getDb()
    .insert(quiraConversations)
    .values({
      product: input.product ?? "shared",
      screen: input.screen ?? "unknown",
      sessionId: input.sessionId,
      source: "signed_in",
      title: titleFromMessage(input.message),
      userId: user.id,
    })
    .returning();

  return created;
}

async function addMessage(input: {
  content: string;
  conversationId: string;
  metadata?: Record<string, unknown>;
  role: "assistant" | "system" | "tool" | "user";
  userId?: string;
}) {
  const [message] = await getDb()
    .insert(quiraMessages)
    .values({
      content: input.content,
      conversationId: input.conversationId,
      metadata: input.metadata ?? {},
      role: input.role,
      userId: input.userId,
    })
    .returning();

  await getDb()
    .update(quiraConversations)
    .set({ updatedAt: new Date() })
    .where(eq(quiraConversations.id, input.conversationId));

  return message;
}

async function recentMessages(conversationId: string) {
  const rows = await getDb()
    .select({
      content: quiraMessages.content,
      createdAt: quiraMessages.createdAt,
      role: quiraMessages.role,
    })
    .from(quiraMessages)
    .where(eq(quiraMessages.conversationId, conversationId))
    .orderBy(desc(quiraMessages.createdAt))
    .limit(10);

  return rows.reverse();
}

function articleScore(article: KnowledgeArticleRecord, query: string, product: string) {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2);
  const haystack = `${article.title} ${article.category} ${article.content} ${article.tags.join(" ")}`.toLowerCase();
  const termScore = terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
  const productScore = article.product === product ? 3 : article.product === "shared" ? 1 : 0;

  return termScore + productScore;
}

export async function searchQuiraKnowledge(input: {
  product?: string;
  query: string;
}) {
  const product = cleanProduct(input.product);
  const query = cleanText(input.query, 400) ?? "";
  const rows = await getDb()
    .select({
      category: quiraKnowledgeArticles.category,
      content: quiraKnowledgeArticles.content,
      id: quiraKnowledgeArticles.id,
      product: quiraKnowledgeArticles.product,
      slug: quiraKnowledgeArticles.slug,
      tags: quiraKnowledgeArticles.tags,
      title: quiraKnowledgeArticles.title,
    })
    .from(quiraKnowledgeArticles)
    .where(eq(quiraKnowledgeArticles.published, true));

  return rows
    .map((row) => ({
      ...row,
      score: articleScore(row, query, product),
    }))
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((article) => ({
      category: article.category,
      content: article.content,
      id: article.id,
      product: article.product,
      slug: article.slug,
      tags: article.tags,
      title: article.title,
    }));
}

async function createSupportCase(input: {
  conversationId: string;
  details?: Record<string, unknown>;
  kind?: SupportCaseKind;
  product?: string;
  screen?: string;
  sessionId?: string;
  summary: string;
  title?: string;
  urgency?: SupportCaseUrgency;
  userId: string;
}) {
  const title = cleanText(input.title, 160) ?? "Support request";
  const summary = cleanText(input.summary, 2000) ?? title;
  const now = new Date();
  const [supportCase] = await getDb()
    .insert(quiraSupportCases)
    .values({
      conversationId: input.conversationId,
      details: input.details ?? {},
      kind: input.kind ?? "support",
      product: cleanProduct(input.product),
      screen: cleanText(input.screen, MAX_SCREEN_LENGTH) ?? "unknown",
      sessionId: cleanUuid(input.sessionId),
      summary,
      title,
      updatedAt: now,
      urgency: input.urgency ?? "normal",
      userId: input.userId,
    })
    .returning();

  await getDb()
    .update(quiraConversations)
    .set({ status: "escalated", updatedAt: now })
    .where(eq(quiraConversations.id, input.conversationId));

  return supportCase;
}

async function getSessionSupportSnapshot(input: {
  product?: string;
  sessionId?: string;
  userId: string;
}) {
  if (cleanProduct(input.product) !== "interview" || !input.sessionId) {
    return {
      available: false,
      reason: "Session snapshots are currently available for Interview sessions only.",
    };
  }

  const [row] = await getDb()
    .select({
      createdAt: sessions.createdAt,
      endedAt: sessions.endedAt,
      evaluationStatus: sessions.evaluationStatus,
      hasEvaluation: evaluations.id,
      id: sessions.id,
      modeKey: sessions.modeKey,
      status: sessions.status,
      targetRole: sessions.contextSnapshot,
      transcript: sessions.voiceArtifact,
    })
    .from(sessions)
    .leftJoin(evaluations, eq(evaluations.sessionId, sessions.id))
    .where(and(eq(sessions.id, input.sessionId), eq(sessions.userId, input.userId)))
    .limit(1);

  if (!row) {
    return {
      available: false,
      reason: "No matching signed-in Interview session was found.",
    };
  }

  return {
    available: true,
    createdAt: row.createdAt.toISOString(),
    durationSeconds: row.transcript?.durationSeconds,
    endedAt: row.endedAt?.toISOString(),
    evaluationStatus: row.hasEvaluation ? "completed" : row.evaluationStatus,
    modeKey: row.modeKey,
    sessionId: row.id,
    status: row.status,
    transcriptTurns: row.transcript?.transcript?.length ?? 0,
  };
}

async function recordToolEvent(input: {
  conversationId: string;
  event: ToolEventRecord;
  messageId?: string;
}) {
  await getDb().insert(quiraToolEvents).values({
    conversationId: input.conversationId,
    errorMessage:
      input.event.status === "failed" ? String(input.event.output.error ?? "Tool failed.") : undefined,
    input: input.event.input,
    messageId: input.messageId,
    output: input.event.output,
    status: input.event.status,
    toolName: input.event.toolName,
  });
}

function supportContext(input: {
  browserContext?: Record<string, unknown>;
  knowledge: KnowledgeArticleRecord[];
  product: string;
  screen: string;
  sessionSnapshot?: Record<string, unknown>;
  user: QuiraChatUser;
}) {
  return [
    `Signed-in user: ${input.user.email ?? input.user.name ?? input.user.id}`,
    `Current product: ${input.product}`,
    `Current screen: ${input.screen}`,
    `Browser context: ${JSON.stringify(input.browserContext ?? {})}`,
    `Safe session snapshot: ${JSON.stringify(input.sessionSnapshot ?? { available: false })}`,
    "Published Quira knowledge:",
    input.knowledge.length
      ? input.knowledge
          .map(
            (article, index) =>
              `${index + 1}. ${article.title} [${article.product}/${article.category}]: ${article.content}`,
          )
          .join("\n")
      : "No matching published KB articles were found.",
  ].join("\n");
}

function responseText(response: ResponsesApiResponse) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const text = response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter(Boolean)
    .join("\n")
    .trim();

  return text || undefined;
}

function functionCalls(response: ResponsesApiResponse) {
  return (response.output ?? []).filter(
    (item) => item.type === "function_call" && item.name && item.call_id,
  );
}

function toolDefinitions() {
  return [
    {
      description: "Search published Quira support knowledge articles.",
      name: "search_quira_knowledge",
      parameters: {
        additionalProperties: false,
        properties: {
          product: { type: "string" },
          query: { type: "string" },
        },
        required: ["query"],
        type: "object",
      },
      type: "function",
    },
    {
      description: "Create a support case for human review in QuesIQ Admin.",
      name: "create_support_case",
      parameters: {
        additionalProperties: false,
        properties: {
          summary: { type: "string" },
          title: { type: "string" },
          urgency: { enum: ["low", "normal", "high"], type: "string" },
        },
        required: ["title", "summary"],
        type: "object",
      },
      type: "function",
    },
    {
      description: "Record a bug report as a Quira support case.",
      name: "record_bug_report",
      parameters: {
        additionalProperties: false,
        properties: {
          summary: { type: "string" },
          title: { type: "string" },
          urgency: { enum: ["low", "normal", "high"], type: "string" },
        },
        required: ["title", "summary"],
        type: "object",
      },
      type: "function",
    },
    {
      description: "Get safe status fields for a signed-in user's session.",
      name: "get_session_support_snapshot",
      parameters: {
        additionalProperties: false,
        properties: {
          sessionId: { type: "string" },
        },
        required: ["sessionId"],
        type: "object",
      },
      type: "function",
    },
  ];
}

async function callResponsesApi(input: {
  apiKey: string;
  body: Record<string, unknown>;
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify(input.body),
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const json = (await response.json()) as ResponsesApiResponse;

  if (!response.ok) {
    throw new Error(json.error?.message || "OpenAI Responses API request failed.");
  }

  return json;
}

function parseToolArguments(value: string | undefined) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);

    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function runTool(input: {
  args: Record<string, unknown>;
  conversationId: string;
  name: string;
  product: string;
  screen: string;
  sessionId?: string;
  userId: string;
}) {
  if (input.name === "search_quira_knowledge") {
    const matches = await searchQuiraKnowledge({
      product: cleanText(input.args.product, MAX_PRODUCT_LENGTH) ?? input.product,
      query: cleanText(input.args.query, 400) ?? "",
    });

    return { matches };
  }

  if (input.name === "create_support_case" || input.name === "record_bug_report") {
    const supportCase = await createSupportCase({
      conversationId: input.conversationId,
      details: { tool: input.name },
      kind: input.name === "record_bug_report" ? "bug" : "support",
      product: input.product,
      screen: input.screen,
      sessionId: input.sessionId,
      summary: cleanText(input.args.summary, 2000) ?? "Support case created from Quira chat.",
      title: cleanText(input.args.title, 160) ?? "Quira support case",
      urgency:
        input.args.urgency === "high" || input.args.urgency === "low"
          ? input.args.urgency
          : "normal",
      userId: input.userId,
    });

    return { caseId: supportCase.id, status: supportCase.status };
  }

  if (input.name === "get_session_support_snapshot") {
    return getSessionSupportSnapshot({
      product: input.product,
      sessionId: cleanUuid(input.args.sessionId) ?? input.sessionId,
      userId: input.userId,
    });
  }

  return { error: "Unsupported tool." };
}

function chatInput(input: {
  context: string;
  history: Array<{ content: string; role: string }>;
  message: string;
}) {
  const historyText = input.history
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  return [
    "Use the support context below to answer the latest user message.",
    "When needed, call tools before finalizing the answer.",
    "",
    "Support context:",
    input.context,
    "",
    "Recent conversation:",
    historyText || "No prior turns.",
    "",
    `Latest user message: ${input.message}`,
  ].join("\n");
}

async function runQuiraModel(input: {
  browserContext?: Record<string, unknown>;
  conversationId: string;
  message: string;
  product: string;
  promptConfig: PromptConfigRecord;
  screen: string;
  sessionId?: string;
  user: QuiraChatUser;
}) {
  const apiKey = getOpenAiApiKey("support");
  const knowledge = await searchQuiraKnowledge({
    product: input.product,
    query: input.message,
  });
  const sessionSnapshot = await getSessionSupportSnapshot({
    product: input.product,
    sessionId: input.sessionId,
    userId: input.user.id,
  });
  const context = supportContext({
    browserContext: input.browserContext,
    knowledge,
    product: input.product,
    screen: input.screen,
    sessionSnapshot,
    user: input.user,
  });

  if (!apiKey) {
    return {
      text:
        "Quira chat is temporarily unavailable because the support AI key is not configured. I saved your message, and an admin can still review it if you create a support case.",
      toolEvents: [],
      usage: undefined,
    };
  }

  const history = await recentMessages(input.conversationId);
  const aiRun = await startAiRun({
    model: input.promptConfig.model,
    promptConfigId: input.promptConfig.id.endsWith(":fallback") ? undefined : input.promptConfig.id,
    promptConfigKey: input.promptConfig.key,
    promptConfigVersion: input.promptConfig.version,
    promptSnapshot: input.promptConfig.instructions,
    runType: "quira_support",
    userId: input.user.id,
  });
  const toolEvents: ToolEventRecord[] = [];

  try {
    let response = await callResponsesApi({
      apiKey,
      body: {
        input: [
          {
            content: chatInput({
              context,
              history,
              message: input.message,
            }),
            role: "user",
          },
        ],
        instructions: input.promptConfig.instructions,
        max_output_tokens: 900,
        model: input.promptConfig.model,
        tools: toolDefinitions(),
      },
    });

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const calls = functionCalls(response);

      if (calls.length === 0) {
        break;
      }

      const outputs = [];

      for (const call of calls) {
        const args = parseToolArguments(call.arguments);
        let output: Record<string, unknown>;
        let status: "failed" | "succeeded" = "succeeded";

        try {
          output = await runTool({
            args,
            conversationId: input.conversationId,
            name: call.name ?? "",
            product: input.product,
            screen: input.screen,
            sessionId: input.sessionId,
            userId: input.user.id,
          });
        } catch (error) {
          status = "failed";
          output = {
            error: error instanceof Error ? error.message : "Tool failed.",
          };
        }

        const event = {
          input: args,
          output,
          status,
          toolName: call.name ?? "unknown",
        };
        toolEvents.push(event);
        await recordToolEvent({
          conversationId: input.conversationId,
          event,
        });
        outputs.push({
          call_id: call.call_id,
          output: JSON.stringify(output),
          type: "function_call_output",
        });
      }

      response = await callResponsesApi({
        apiKey,
        body: {
          input: outputs,
          max_output_tokens: 900,
          model: input.promptConfig.model,
          previous_response_id: response.id,
          tools: toolDefinitions(),
        },
      });
    }

    const text =
      responseText(response) ??
      "I could not produce a support answer from the available context. I can create a support case so an admin can review it.";

    await completeAiRun(aiRun.id, {
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      providerRequestId: response.id,
      rawJson: response as unknown as Record<string, unknown>,
      status: "succeeded",
      totalTokens: response.usage?.total_tokens,
    });

    return {
      text,
      toolEvents,
      usage: response.usage,
    };
  } catch (error) {
    await completeAiRun(aiRun.id, {
      errorMessage: error instanceof Error ? error.message : "Quira support chat failed.",
      status: "failed",
    });

    throw error;
  }
}

export async function handleQuiraChat(input: QuiraChatInput, user: QuiraChatUser) {
  const conversation = await getOrCreateConversation(input, user);
  const userMessage = await addMessage({
    content: input.message,
    conversationId: conversation.id,
    metadata: {
      browserContext: input.browserContext,
      product: input.product,
      screen: input.screen,
      sessionId: input.sessionId,
    },
    role: "user",
    userId: user.id,
  });
  const promptConfig = await getActivePromptConfig("quira_support_chat");
  const result = await runQuiraModel({
    browserContext: input.browserContext,
    conversationId: conversation.id,
    message: input.message,
    product: input.product ?? conversation.product,
    promptConfig,
    screen: input.screen ?? conversation.screen,
    sessionId: input.sessionId ?? conversation.sessionId ?? undefined,
    user,
  });
  const assistantMessage = await addMessage({
    content: result.text,
    conversationId: conversation.id,
    metadata: {
      promptConfigKey: promptConfig.key,
      promptConfigVersion: promptConfig.version,
      toolEvents: result.toolEvents.map((event) => ({
        status: event.status,
        toolName: event.toolName,
      })),
      usage: result.usage,
    },
    role: "assistant",
    userId: user.id,
  });

  return {
    conversationId: conversation.id,
    message: {
      content: assistantMessage.content,
      createdAt: assistantMessage.createdAt.toISOString(),
      id: assistantMessage.id,
      role: assistantMessage.role,
    },
    userMessageId: userMessage.id,
  };
}

export async function listQuiraAdminSupportData(limit = 100) {
  const [cases, conversations, articles] = await Promise.all([
    getDb()
      .select({
        createdAt: quiraSupportCases.createdAt,
        id: quiraSupportCases.id,
        kind: quiraSupportCases.kind,
        product: quiraSupportCases.product,
        screen: quiraSupportCases.screen,
        sessionId: quiraSupportCases.sessionId,
        status: quiraSupportCases.status,
        summary: quiraSupportCases.summary,
        title: quiraSupportCases.title,
        urgency: quiraSupportCases.urgency,
        userEmail: users.email,
        userId: quiraSupportCases.userId,
      })
      .from(quiraSupportCases)
      .leftJoin(users, eq(users.id, quiraSupportCases.userId))
      .orderBy(desc(quiraSupportCases.createdAt))
      .limit(limit),
    getDb()
      .select({
        createdAt: quiraConversations.createdAt,
        id: quiraConversations.id,
        product: quiraConversations.product,
        screen: quiraConversations.screen,
        status: quiraConversations.status,
        title: quiraConversations.title,
        updatedAt: quiraConversations.updatedAt,
        userEmail: users.email,
        userId: quiraConversations.userId,
      })
      .from(quiraConversations)
      .leftJoin(users, eq(users.id, quiraConversations.userId))
      .orderBy(desc(quiraConversations.updatedAt))
      .limit(limit),
    getDb()
      .select({
        category: quiraKnowledgeArticles.category,
        content: quiraKnowledgeArticles.content,
        displayOrder: quiraKnowledgeArticles.displayOrder,
        id: quiraKnowledgeArticles.id,
        product: quiraKnowledgeArticles.product,
        published: quiraKnowledgeArticles.published,
        slug: quiraKnowledgeArticles.slug,
        tags: quiraKnowledgeArticles.tags,
        title: quiraKnowledgeArticles.title,
        updatedAt: quiraKnowledgeArticles.updatedAt,
      })
      .from(quiraKnowledgeArticles)
      .orderBy(desc(quiraKnowledgeArticles.updatedAt))
      .limit(limit),
  ]);

  return {
    articles: articles.map((article) => ({
      ...article,
      updatedAt: article.updatedAt.toISOString(),
    })),
    cases: cases.map((supportCase) => ({
      ...supportCase,
      createdAt: supportCase.createdAt.toISOString(),
    })),
    conversations: conversations.map((conversation) => ({
      ...conversation,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    })),
  };
}
