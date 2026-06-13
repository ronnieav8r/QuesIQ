import { createHash } from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";

import type { PromptConfigRecord } from "@/product/interview-types";
import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import { getDb } from "@/server/db/client";
import {
  evaluations,
  quiraAnswerFeedback,
  quiraAttachments,
  quiraCaseEvents,
  quiraCaseTags,
  quiraLeads,
  quiraConversations,
  quiraKnownIssues,
  quiraKnowledgeArticles,
  quiraMessages,
  quiraSupportCases,
  quiraToolEvents,
  sessions,
  studyCardAttempts,
  studyCards,
  studyDecks,
  studyDeckStacks,
  studySessions,
  users,
} from "@/server/db/schema";
import { getOpenAiApiKey } from "@/server/openai/keys";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";
import {
  isSupportStorageConfigured,
  supportAttachmentFromDataUrl,
  uploadSupportAttachment,
} from "@/server/support/storage";

type QuiraProduct = "dpe" | "interview" | "shared" | "study";
type SupportCaseKind = "bug" | "feedback" | "support";
type SupportCaseStatus = "in_progress" | "new" | "resolved" | "triage";
type SupportCaseUrgency = "high" | "low" | "normal";
type SupportSeverity = "critical" | "high" | "low" | "normal";
type KnownIssueStatus = "archived" | "fixed" | "investigating" | "open";
type KnowledgeReviewStatus = "archived" | "draft" | "reviewed";

type QuiraChatInput = {
  browserContext?: Record<string, unknown>;
  conversationId?: string;
  message: string;
  product?: string;
  screen?: string;
  sessionId?: string;
  source?: "public" | "signed_in";
};

type QuiraSupportReportInput = {
  browserContext?: Record<string, unknown>;
  conversationId?: string;
  kind: SupportCaseKind;
  message: string;
  product?: string;
  rating?: number;
  screen?: string;
  screenshotDataUrl?: string;
  screenshotMimeType?: string;
  screenshotName?: string;
  screenshotSize?: number;
  sessionId?: string;
  urgency?: SupportCaseUrgency;
};

type QuiraChatUser = {
  email?: string | null;
  id?: string;
  name?: string | null;
  source: "public" | "signed_in";
};

type KnowledgeArticleRecord = {
  audience: "public" | "signed_in";
  category: string;
  content: string;
  id: string;
  product: string;
  slug: string;
  tags: string[];
  title: string;
};

type KnownIssueRecord = {
  affectedScreens: string[];
  id: string;
  product: string;
  severity: SupportSeverity;
  status: KnownIssueStatus;
  summary: string;
  title: string;
  workaround?: string | null;
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

function cleanSeverity(value: unknown): SupportSeverity {
  const severity = cleanText(value, 40)?.toLowerCase();

  if (
    severity === "critical" ||
    severity === "high" ||
    severity === "low" ||
    severity === "normal"
  ) {
    return severity;
  }

  return "normal";
}

function cleanKnownIssueStatus(value: unknown): KnownIssueStatus {
  const status = cleanText(value, 40)?.toLowerCase();

  if (
    status === "archived" ||
    status === "fixed" ||
    status === "investigating" ||
    status === "open"
  ) {
    return status;
  }

  return "open";
}

function cleanKnowledgeReviewStatus(value: unknown): KnowledgeReviewStatus {
  const status = cleanText(value, 40)?.toLowerCase();

  if (status === "archived" || status === "draft" || status === "reviewed") {
    return status;
  }

  return "draft";
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

function cleanTags(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanText(item, 40)?.toLowerCase().replace(/[^a-z0-9_-]+/g, "-"))
      .filter((item): item is string => Boolean(item))
      .slice(0, 12);
  }

  return (cleanText(value, 400) ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-"))
    .filter(Boolean)
    .slice(0, 12);
}

function cleanConversationSource(value: unknown): "public" | "signed_in" {
  return value === "public" ? "public" : "signed_in";
}

function cleanJsonValue(value: unknown, depth = 0): unknown {
  if (depth > 3) {
    return undefined;
  }

  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return typeof value === "string" ? value.slice(0, 500) : value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => cleanJsonValue(item, depth + 1));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 30)
        .map(([key, item]) => [key.slice(0, 80), cleanJsonValue(item, depth + 1)])
        .filter(([, item]) => item !== undefined),
    );
  }

  return undefined;
}

function cleanBrowserContext(value: unknown) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const candidate = value as Record<string, unknown>;

  return {
    contextDetails: cleanJsonValue(candidate.contextDetails),
    language: cleanText(candidate.language, 80),
    pathname: cleanText(candidate.pathname, 200),
    timeZone: cleanText(candidate.timeZone, 80),
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
    source: cleanConversationSource(candidate.source),
  };
}

export function parseQuiraSupportReportInput(
  body: unknown,
): QuiraSupportReportInput | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const candidate = body as Record<string, unknown>;
  const message = cleanText(candidate.message, MAX_MESSAGE_LENGTH);
  const rating =
    typeof candidate.rating === "number" &&
    Number.isInteger(candidate.rating) &&
    candidate.rating >= 1 &&
    candidate.rating <= 5
      ? candidate.rating
      : undefined;
  const screenshotSize =
    typeof candidate.screenshotSize === "number" &&
    Number.isInteger(candidate.screenshotSize) &&
    candidate.screenshotSize > 0 &&
    candidate.screenshotSize <= 1_500_000
      ? candidate.screenshotSize
      : undefined;
  const kind =
    candidate.kind === "bug"
      ? "bug"
      : candidate.kind === "feedback"
        ? "feedback"
        : "support";

  if (!message && rating === undefined && !cleanText(candidate.screenshotDataUrl, 2_100_000)) {
    return undefined;
  }

  return {
    browserContext: cleanBrowserContext(candidate.browserContext),
    conversationId: cleanUuid(candidate.conversationId),
    kind,
    message: message ?? "",
    product: cleanProduct(candidate.product),
    rating,
    screen: cleanText(candidate.screen, MAX_SCREEN_LENGTH) ?? "unknown",
    screenshotDataUrl: cleanText(candidate.screenshotDataUrl, 2_100_000),
    screenshotMimeType: cleanText(candidate.screenshotMimeType, 80),
    screenshotName: cleanText(candidate.screenshotName, 180),
    screenshotSize,
    sessionId: cleanUuid(candidate.sessionId),
    urgency:
      candidate.urgency === "high" || candidate.urgency === "low"
        ? candidate.urgency
        : "normal",
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
  const source = user.source === "public" ? "public" : "signed_in";

  if (input.conversationId) {
    const ownershipFilter = user.id
      ? and(eq(quiraConversations.id, input.conversationId), eq(quiraConversations.userId, user.id))
      : and(
          eq(quiraConversations.id, input.conversationId),
          eq(quiraConversations.source, "public"),
          isNull(quiraConversations.userId),
        );
    const [existing] = await getDb()
      .select()
      .from(quiraConversations)
      .where(ownershipFilter)
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
      source,
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
  source?: "public" | "signed_in";
}) {
  const product = cleanProduct(input.product);
  const query = cleanText(input.query, 400) ?? "";
  const source = input.source ?? "signed_in";
  const rows = await getDb()
    .select({
      audience: quiraKnowledgeArticles.audience,
      category: quiraKnowledgeArticles.category,
      content: quiraKnowledgeArticles.content,
      id: quiraKnowledgeArticles.id,
      product: quiraKnowledgeArticles.product,
      slug: quiraKnowledgeArticles.slug,
      tags: quiraKnowledgeArticles.tags,
      title: quiraKnowledgeArticles.title,
    })
    .from(quiraKnowledgeArticles)
    .where(
      and(
        eq(quiraKnowledgeArticles.published, true),
        eq(quiraKnowledgeArticles.reviewStatus, "reviewed"),
        isNull(quiraKnowledgeArticles.archivedAt),
      ),
    );

  return rows
    .filter((row) => source === "signed_in" || row.audience === "public")
    .map((row) => ({
      ...row,
      score: articleScore(row, query, product),
    }))
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((article) => ({
      audience: article.audience,
      category: article.category,
      content: article.content,
      id: article.id,
      product: article.product,
      slug: article.slug,
      tags: article.tags,
      title: article.title,
    }));
}

function issueScore(issue: KnownIssueRecord, query: string, product: string) {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2);
  const haystack = `${issue.title} ${issue.summary} ${issue.workaround ?? ""} ${issue.affectedScreens.join(" ")}`.toLowerCase();
  const termScore = terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
  const productScore = issue.product === product ? 3 : issue.product === "shared" ? 1 : 0;

  return termScore + productScore;
}

export async function searchQuiraKnownIssues(input: {
  product?: string;
  query: string;
}) {
  const product = cleanProduct(input.product);
  const query = cleanText(input.query, 400) ?? "";
  const rows = await getDb()
    .select({
      affectedScreens: quiraKnownIssues.affectedScreens,
      id: quiraKnownIssues.id,
      product: quiraKnownIssues.product,
      severity: quiraKnownIssues.severity,
      status: quiraKnownIssues.status,
      summary: quiraKnownIssues.summary,
      title: quiraKnownIssues.title,
      workaround: quiraKnownIssues.workaround,
    })
    .from(quiraKnownIssues)
    .where(and(isNull(quiraKnownIssues.archivedAt)));

  return rows
    .filter((row) => row.status === "open" || row.status === "investigating")
    .map((row) => ({
      ...row,
      score: issueScore(row, query, product),
    }))
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((issue) => ({
      affectedScreens: issue.affectedScreens,
      id: issue.id,
      product: issue.product,
      severity: issue.severity,
      status: issue.status,
      summary: issue.summary,
      title: issue.title,
      workaround: issue.workaround,
    }));
}

async function createSupportCase(input: {
  assignedToUserId?: string;
  conversationId: string;
  details?: Record<string, unknown>;
  kind?: SupportCaseKind;
  knownIssueId?: string;
  product?: string;
  screen?: string;
  sessionId?: string;
  severity?: SupportSeverity;
  summary: string;
  tags?: string[];
  title?: string;
  urgency?: SupportCaseUrgency;
  userId?: string;
}) {
  const title = cleanText(input.title, 160) ?? "Support request";
  const summary = cleanText(input.summary, 2000) ?? title;
  const now = new Date();
  const [supportCase] = await getDb()
    .insert(quiraSupportCases)
    .values({
      assignedToUserId: input.assignedToUserId,
      conversationId: input.conversationId,
      details: input.details ?? {},
      kind: input.kind ?? "support",
      knownIssueId: cleanUuid(input.knownIssueId),
      product: cleanProduct(input.product),
      screen: cleanText(input.screen, MAX_SCREEN_LENGTH) ?? "unknown",
      sessionId: cleanUuid(input.sessionId),
      severity: input.severity ?? cleanSeverity(input.urgency),
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

  await recordCaseEvent({
    actorUserId: input.userId,
    caseId: supportCase.id,
    eventType: "created",
    knownIssueId: supportCase.knownIssueId ?? undefined,
    metadata: {
      kind: supportCase.kind,
      product: supportCase.product,
      screen: supportCase.screen,
      severity: supportCase.severity,
      source: input.details?.source ?? input.details?.tool ?? "quira",
    },
    note: summary,
    toStatus: supportCase.status,
  });

  if (input.tags?.length) {
    await setSupportCaseTags({
      actorUserId: input.userId,
      caseId: supportCase.id,
      tags: input.tags,
    });
  }

  return supportCase;
}

async function recordCaseEvent(input: {
  actorUserId?: string;
  caseId: string;
  eventType: string;
  fromStatus?: string | null;
  knownIssueId?: string;
  metadata?: Record<string, unknown>;
  note?: string;
  toStatus?: string | null;
}) {
  await getDb().insert(quiraCaseEvents).values({
    actorUserId: input.actorUserId,
    caseId: input.caseId,
    eventType: input.eventType,
    fromStatus: input.fromStatus,
    knownIssueId: cleanUuid(input.knownIssueId),
    metadata: input.metadata ?? {},
    note: cleanText(input.note, 2000),
    toStatus: input.toStatus,
  });
}

async function setSupportCaseTags(input: {
  actorUserId?: string;
  caseId: string;
  tags: string[];
}) {
  const tags = cleanTags(input.tags);

  if (tags.length === 0) {
    return [];
  }

  const inserted = await getDb()
    .insert(quiraCaseTags)
    .values(
      tags.map((tag) => ({
        caseId: input.caseId,
        createdByUserId: input.actorUserId,
        tag,
      })),
    )
    .onConflictDoNothing()
    .returning();

  for (const tag of inserted) {
    await recordCaseEvent({
      actorUserId: input.actorUserId,
      caseId: input.caseId,
      eventType: "tag_added",
      metadata: { tag: tag.tag },
    });
  }

  return tags;
}

async function createLead(input: {
  conversationId: string;
  details?: Record<string, unknown>;
  email?: string;
  name?: string;
  productInterest?: string;
  source: "public_chat" | "signed_in_chat";
  summary: string;
  userId?: string;
}) {
  const now = new Date();
  const summary = cleanText(input.summary, 2000) ?? "Quira lead created from chat.";
  const [lead] = await getDb()
    .insert(quiraLeads)
    .values({
      conversationId: input.conversationId,
      details: input.details ?? {},
      email: cleanText(input.email, 240),
      name: cleanText(input.name, 180),
      productInterest: cleanProduct(input.productInterest),
      source: input.source,
      summary,
      updatedAt: now,
      userId: input.userId,
    })
    .returning();

  await getDb()
    .update(quiraConversations)
    .set({ updatedAt: now })
    .where(eq(quiraConversations.id, input.conversationId));

  return lead;
}

export function parseQuiraSupportCaseStatus(value: unknown): SupportCaseStatus | undefined {
  return value === "new" ||
    value === "triage" ||
    value === "in_progress" ||
    value === "resolved"
    ? value
    : undefined;
}

export async function updateQuiraSupportCaseStatus(input: {
  caseId: string;
  status: SupportCaseStatus;
  userId?: string;
}) {
  const caseId = cleanUuid(input.caseId);
  if (!caseId) {
    return undefined;
  }

  const [existing] = await getDb()
    .select({
      conversationId: quiraSupportCases.conversationId,
      id: quiraSupportCases.id,
      status: quiraSupportCases.status,
      title: quiraSupportCases.title,
      userId: quiraSupportCases.userId,
    })
    .from(quiraSupportCases)
    .where(eq(quiraSupportCases.id, caseId))
    .limit(1);

  if (!existing) {
    return undefined;
  }

  const now = new Date();
  const [updated] = await getDb()
    .update(quiraSupportCases)
    .set({
      resolvedAt: input.status === "resolved" ? now : null,
      status: input.status,
      updatedAt: now,
    })
    .where(eq(quiraSupportCases.id, existing.id))
    .returning({
      conversationId: quiraSupportCases.conversationId,
      id: quiraSupportCases.id,
      status: quiraSupportCases.status,
      updatedAt: quiraSupportCases.updatedAt,
    });

  await recordCaseEvent({
    actorUserId: input.userId,
    caseId: existing.id,
    eventType: "status_changed",
    fromStatus: existing.status,
    toStatus: input.status,
  });

  if (existing.conversationId) {
    await getDb()
      .update(quiraConversations)
      .set({
        status: input.status === "resolved" ? "resolved" : "escalated",
        updatedAt: now,
      })
      .where(eq(quiraConversations.id, existing.conversationId));

    await addMessage({
      content: `Admin updated support case "${existing.title}" to ${input.status}.`,
      conversationId: existing.conversationId,
      metadata: {
        caseId: existing.id,
        updatedByUserId: input.userId,
      },
      role: "system",
      userId: existing.userId ?? undefined,
    });
  }

  return updated;
}

function slugFromTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function saveQuiraKnowledgeArticle(input: {
  articleId?: string;
  audience?: unknown;
  category?: unknown;
  content?: unknown;
  product?: unknown;
  published?: unknown;
  reviewStatus?: unknown;
  slug?: unknown;
  tags?: unknown;
  title?: unknown;
  userId: string;
}) {
  const title = cleanText(input.title, 180);
  const content = cleanText(input.content, 20_000);

  if (!title || !content) {
    throw new Error("Knowledge article title and content are required.");
  }

  const requestedReviewStatus = cleanKnowledgeReviewStatus(input.reviewStatus);
  const published = Boolean(input.published);
  const reviewStatus = published ? "reviewed" : requestedReviewStatus;
  const archivedAt = reviewStatus === "archived" ? new Date() : null;
  const audience: "public" | "signed_in" =
    input.audience === "signed_in" ? "signed_in" : "public";
  const values = {
    archivedAt,
    audience,
    category: cleanText(input.category, 80) ?? "general",
    content,
    product: cleanProduct(input.product),
    published: published && !archivedAt,
    reviewStatus,
    reviewedAt: reviewStatus === "reviewed" ? new Date() : null,
    reviewedBy: reviewStatus === "reviewed" ? input.userId : undefined,
    slug: cleanText(input.slug, 120) ?? slugFromTitle(title),
    sourceType: "admin" as const,
    tags: cleanTags(input.tags),
    title,
    updatedAt: new Date(),
    vectorSyncStatus: published && !archivedAt ? ("pending" as const) : ("not_synced" as const),
  };
  const articleId = cleanUuid(input.articleId);

  if (articleId) {
    const [article] = await getDb()
      .update(quiraKnowledgeArticles)
      .set(values)
      .where(eq(quiraKnowledgeArticles.id, articleId))
      .returning();

    return article;
  }

  const [article] = await getDb()
    .insert(quiraKnowledgeArticles)
    .values(values)
    .returning();

  return article;
}

export async function saveQuiraKnownIssue(input: {
  adminNotes?: unknown;
  affectedScreens?: unknown;
  issueId?: string;
  product?: unknown;
  severity?: unknown;
  status?: unknown;
  summary?: unknown;
  title?: unknown;
  userId: string;
  workaround?: unknown;
}) {
  const title = cleanText(input.title, 180);
  const summary = cleanText(input.summary, 4000);

  if (!title || !summary) {
    throw new Error("Known issue title and summary are required.");
  }

  const status = cleanKnownIssueStatus(input.status);
  const now = new Date();
  const fixedAt = status === "fixed" || status === "archived" ? now : null;
  const archivedAt = status === "fixed" || status === "archived" ? now : null;
  const values = {
    adminNotes: cleanText(input.adminNotes, 4000),
    affectedScreens: cleanTags(input.affectedScreens),
    archivedAt,
    fixedAt,
    product: cleanProduct(input.product),
    severity: cleanSeverity(input.severity),
    status,
    summary,
    title,
    updatedAt: now,
    updatedByUserId: input.userId,
    workaround: cleanText(input.workaround, 4000),
  };
  const issueId = cleanUuid(input.issueId);

  if (issueId) {
    const [issue] = await getDb()
      .update(quiraKnownIssues)
      .set(values)
      .where(eq(quiraKnownIssues.id, issueId))
      .returning();

    return issue;
  }

  const [issue] = await getDb()
    .insert(quiraKnownIssues)
    .values({
      ...values,
      createdByUserId: input.userId,
    })
    .returning();

  return issue;
}

export async function updateQuiraSupportCaseTriage(input: {
  assignedToUserId?: unknown;
  caseId?: unknown;
  knownIssueId?: unknown;
  note?: unknown;
  severity?: unknown;
  status?: unknown;
  tags?: unknown;
  userId: string;
}) {
  const caseId = cleanUuid(input.caseId);
  if (!caseId) {
    throw new Error("Valid caseId is required.");
  }

  const [existing] = await getDb()
    .select({
      assignedToUserId: quiraSupportCases.assignedToUserId,
      knownIssueId: quiraSupportCases.knownIssueId,
      severity: quiraSupportCases.severity,
      status: quiraSupportCases.status,
    })
    .from(quiraSupportCases)
    .where(eq(quiraSupportCases.id, caseId))
    .limit(1);

  if (!existing) {
    throw new Error("Quira support case was not found.");
  }

  const status = parseQuiraSupportCaseStatus(input.status) ?? existing.status;
  const knownIssueId =
    input.knownIssueId === null || input.knownIssueId === "" ? null : cleanUuid(input.knownIssueId);
  const assignedToUserId =
    input.assignedToUserId === null || input.assignedToUserId === ""
      ? null
      : cleanText(input.assignedToUserId, 160);
  const now = new Date();
  const [supportCase] = await getDb()
    .update(quiraSupportCases)
    .set({
      assignedToUserId: assignedToUserId ?? existing.assignedToUserId,
      knownIssueId: knownIssueId ?? existing.knownIssueId,
      resolvedAt: status === "resolved" ? now : null,
      severity: cleanSeverity(input.severity ?? existing.severity),
      status,
      updatedAt: now,
    })
    .where(eq(quiraSupportCases.id, caseId))
    .returning();

  if (status !== existing.status) {
    await recordCaseEvent({
      actorUserId: input.userId,
      caseId,
      eventType: "status_changed",
      fromStatus: existing.status,
      toStatus: status,
    });
  }

  if (knownIssueId && knownIssueId !== existing.knownIssueId) {
    await recordCaseEvent({
      actorUserId: input.userId,
      caseId,
      eventType: "known_issue_linked",
      knownIssueId,
    });
  }

  const note = cleanText(input.note, 2000);
  if (note) {
    await recordCaseEvent({
      actorUserId: input.userId,
      caseId,
      eventType: "note_added",
      note,
    });
  }

  const tags = cleanTags(input.tags);
  if (tags.length > 0) {
    await setSupportCaseTags({
      actorUserId: input.userId,
      caseId,
      tags,
    });
  }

  return supportCase;
}

export async function recordQuiraAnswerFeedback(input: {
  comment?: unknown;
  conversationId?: unknown;
  messageId?: unknown;
  rating?: unknown;
  userId?: string;
}) {
  const conversationId = cleanUuid(input.conversationId);
  const messageId = cleanUuid(input.messageId);
  const rating = input.rating === "not_helpful" ? "not_helpful" : "helpful";

  if (!conversationId || !messageId) {
    throw new Error("Valid conversationId and messageId are required.");
  }

  const [feedback] = await getDb()
    .insert(quiraAnswerFeedback)
    .values({
      comment: cleanText(input.comment, 1000),
      conversationId,
      messageId,
      rating,
      userId: input.userId,
    })
    .returning();

  return feedback;
}

async function getSessionSupportSnapshot(input: {
  product?: string;
  sessionId?: string;
  userId?: string;
}) {
  if (!input.userId) {
    return {
      available: false,
      reason: "Sign in is required before Quira can inspect private session status.",
    };
  }

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

function browserContextRecord(value?: Record<string, unknown>) {
  return value && typeof value === "object" ? value : {};
}

function contextDetails(value?: Record<string, unknown>) {
  const context = browserContextRecord(value);
  const details = context.contextDetails;

  return details && typeof details === "object" ? (details as Record<string, unknown>) : {};
}

function findUuidInText(value: unknown, pattern: RegExp) {
  const text = cleanText(value, 240);
  const match = text?.match(pattern);

  return cleanUuid(match?.[1]);
}

function contextUuid(input: {
  browserContext?: Record<string, unknown>;
  key: string;
  pathnamePattern: RegExp;
}) {
  const details = contextDetails(input.browserContext);

  return cleanUuid(details[input.key]) ?? findUuidInText(input.browserContext?.pathname, input.pathnamePattern);
}

async function getStudySupportSnapshot(input: {
  browserContext?: Record<string, unknown>;
  sessionId?: string;
  userId?: string;
}) {
  if (!input.userId) {
    return {
      available: false,
      reason: "Sign in is required before Quira can inspect private Study progress.",
    };
  }

  const deckId =
    contextUuid({
      browserContext: input.browserContext,
      key: "deckId",
      pathnamePattern: /\/study\/decks\/([0-9a-f-]+)/i,
    }) ?? undefined;
  const stackId = contextUuid({
    browserContext: input.browserContext,
    key: "stackId",
    pathnamePattern: /\/study\/stacks\/([0-9a-f-]+)/i,
  });

  const recentSessionRows = await getDb()
    .select({
      cardsStudied: studySessions.cardsStudied,
      correctCount: studySessions.correctCount,
      deckId: studySessions.deckId,
      endedAt: studySessions.endedAt,
      id: studySessions.id,
      mode: studySessions.mode,
      startedAt: studySessions.startedAt,
    })
    .from(studySessions)
    .where(eq(studySessions.userId, input.userId))
    .orderBy(desc(studySessions.startedAt))
    .limit(3);

  let deckSnapshot: Record<string, unknown> | undefined;
  if (deckId) {
    const [deck] = await getDb()
      .select({
        cardCount: studyDecks.cardCount,
        id: studyDecks.id,
        isOfficial: studyDecks.isOfficial,
        isPublic: studyDecks.isPublic,
        subject: studyDecks.subject,
        title: studyDecks.title,
        userId: studyDecks.userId,
        verifiedCardCount: studyDecks.verifiedCardCount,
      })
      .from(studyDecks)
      .where(eq(studyDecks.id, deckId))
      .limit(1);

    if (deck && (deck.isPublic || deck.isOfficial || deck.userId === input.userId)) {
      const cards = await getDb()
        .select({
          dueAt: studyCards.dueAt,
          id: studyCards.id,
          isVerified: studyCards.isVerified,
        })
        .from(studyCards)
        .where(eq(studyCards.deckId, deck.id));
      const attempts = await getDb()
        .select({
          attemptedAt: studyCardAttempts.attemptedAt,
          isCorrect: studyCardAttempts.isCorrect,
          score: studyCardAttempts.score,
          verdict: studyCardAttempts.verdict,
        })
        .from(studyCardAttempts)
        .leftJoin(studyCards, eq(studyCards.id, studyCardAttempts.cardId))
        .where(eq(studyCards.deckId, deck.id))
        .orderBy(desc(studyCardAttempts.attemptedAt))
        .limit(5);

      deckSnapshot = {
        cardCount: deck.cardCount || cards.length,
        deckId: deck.id,
        isOfficial: deck.isOfficial,
        recentAttempts: attempts.map((attempt) => ({
          attemptedAt: attempt.attemptedAt.toISOString(),
          isCorrect: attempt.isCorrect,
          score: attempt.score,
          verdict: attempt.verdict,
        })),
        subject: deck.subject,
        title: deck.title,
        verifiedCardCount: deck.verifiedCardCount,
      };
    }
  }

  let stackSnapshot: Record<string, unknown> | undefined;
  if (stackId) {
    const [stack] = await getDb()
      .select({
        id: studyDeckStacks.id,
        isOfficial: studyDeckStacks.isOfficial,
        isPublic: studyDeckStacks.isPublic,
        subject: studyDeckStacks.subject,
        title: studyDeckStacks.title,
        userId: studyDeckStacks.userId,
      })
      .from(studyDeckStacks)
      .where(eq(studyDeckStacks.id, stackId))
      .limit(1);

    if (stack && (stack.isPublic || stack.isOfficial || stack.userId === input.userId)) {
      stackSnapshot = {
        isOfficial: stack.isOfficial,
        stackId: stack.id,
        subject: stack.subject,
        title: stack.title,
      };
    }
  }

  return {
    available: true,
    deck: deckSnapshot,
    recentSessions: recentSessionRows.map((session) => ({
      cardsStudied: session.cardsStudied,
      correctCount: session.correctCount,
      deckId: session.deckId,
      endedAt: session.endedAt?.toISOString(),
      mode: session.mode,
      sessionId: session.id,
      startedAt: session.startedAt.toISOString(),
    })),
    stack: stackSnapshot,
  };
}

async function getProductSupportContext(input: {
  browserContext?: Record<string, unknown>;
  product?: string;
  sessionId?: string;
  userId?: string;
}) {
  const product = cleanProduct(input.product);

  if (product === "study") {
    return getStudySupportSnapshot(input);
  }

  if (product === "interview") {
    return getSessionSupportSnapshot(input);
  }

  return {
    available: false,
    reason: "Product support context is currently available for Study and Interview.",
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
  knownIssues: KnownIssueRecord[];
  knowledge: KnowledgeArticleRecord[];
  product: string;
  productContext?: Record<string, unknown>;
  screen: string;
  sessionSnapshot?: Record<string, unknown>;
  user: QuiraChatUser;
}) {
  const userLabel =
    input.user.source === "signed_in"
      ? input.user.email ?? input.user.name ?? input.user.id ?? "signed-in user"
      : "public visitor";

  return [
    `Visitor context: ${userLabel}`,
    `Access level: ${input.user.source}`,
    `Current product: ${input.product}`,
    `Current screen: ${input.screen}`,
    `Browser context: ${JSON.stringify(input.browserContext ?? {})}`,
    `Safe product context: ${JSON.stringify(input.productContext ?? { available: false })}`,
    `Safe session snapshot: ${JSON.stringify(input.sessionSnapshot ?? { available: false })}`,
    "Current known issues:",
    input.knownIssues.length
      ? input.knownIssues
          .map(
            (issue, index) =>
              `${index + 1}. ${issue.title} [${issue.product}/${issue.status}/${issue.severity}]: ${issue.summary}${issue.workaround ? ` Workaround: ${issue.workaround}` : ""}`,
          )
          .join("\n")
      : "No matching open or investigating known issues were found.",
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
  const tools: Record<string, unknown>[] = [
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
      description: "Search open or investigating Quira known issues. Fixed and archived issues are hidden.",
      name: "search_quira_known_issues",
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
      description:
        "Get safe user-facing product support context for the current Study or Interview screen.",
      name: "get_product_support_context",
      parameters: {
        additionalProperties: false,
        properties: {
          sessionId: { type: "string" },
        },
        required: [],
        type: "object",
      },
      type: "function",
    },
    {
      description:
        "Create a lead for public or signed-in follow-up about beta access, pricing, signup, product fit, or human contact.",
      name: "create_lead",
      parameters: {
        additionalProperties: false,
        properties: {
          email: { type: "string" },
          name: { type: "string" },
          productInterest: { type: "string" },
          summary: { type: "string" },
        },
        required: ["summary"],
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
          severity: { enum: ["low", "normal", "high", "critical"], type: "string" },
          tags: { items: { type: "string" }, type: "array" },
          knownIssueId: { type: "string" },
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
          severity: { enum: ["low", "normal", "high", "critical"], type: "string" },
          tags: { items: { type: "string" }, type: "array" },
          knownIssueId: { type: "string" },
        },
        required: ["title", "summary"],
        type: "object",
      },
      type: "function",
    },
    {
      description: "Record product feedback as a Quira feedback case for admin review.",
      name: "record_feedback",
      parameters: {
        additionalProperties: false,
        properties: {
          summary: { type: "string" },
          title: { type: "string" },
          urgency: { enum: ["low", "normal", "high"], type: "string" },
          severity: { enum: ["low", "normal", "high", "critical"], type: "string" },
          tags: { items: { type: "string" }, type: "array" },
          knownIssueId: { type: "string" },
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

  if (process.env.OPENAI_QUIRA_VECTOR_STORE_ID) {
    tools.push({
      max_num_results: 5,
      type: "file_search",
      vector_store_ids: [process.env.OPENAI_QUIRA_VECTOR_STORE_ID],
    });
  }

  return tools;
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
  browserContext?: Record<string, unknown>;
  conversationId: string;
  name: string;
  product: string;
  screen: string;
  sessionId?: string;
  userId?: string;
}) {
  if (input.name === "search_quira_knowledge") {
    const matches = await searchQuiraKnowledge({
      product: cleanText(input.args.product, MAX_PRODUCT_LENGTH) ?? input.product,
      query: cleanText(input.args.query, 400) ?? "",
      source: input.userId ? "signed_in" : "public",
    });

    return { matches };
  }

  if (input.name === "search_quira_known_issues") {
    const matches = await searchQuiraKnownIssues({
      product: cleanText(input.args.product, MAX_PRODUCT_LENGTH) ?? input.product,
      query: cleanText(input.args.query, 400) ?? "",
    });

    return { matches };
  }

  if (input.name === "get_product_support_context") {
    return getProductSupportContext({
      browserContext: input.browserContext,
      product: input.product,
      sessionId: cleanUuid(input.args.sessionId) ?? input.sessionId,
      userId: input.userId,
    });
  }

  if (input.name === "create_lead") {
    const lead = await createLead({
      conversationId: input.conversationId,
      details: { tool: input.name },
      email: cleanText(input.args.email, 240),
      name: cleanText(input.args.name, 180),
      productInterest: cleanText(input.args.productInterest, MAX_PRODUCT_LENGTH) ?? input.product,
      source: input.userId ? "signed_in_chat" : "public_chat",
      summary: cleanText(input.args.summary, 2000) ?? "Lead created from Quira chat.",
      userId: input.userId,
    });

    return { leadId: lead.id, status: lead.status };
  }

  if (
    input.name === "create_support_case" ||
    input.name === "record_bug_report" ||
    input.name === "record_feedback"
  ) {
    const supportCase = await createSupportCase({
      conversationId: input.conversationId,
      details: { browserContext: input.browserContext, tool: input.name },
      kind:
        input.name === "record_bug_report"
          ? "bug"
          : input.name === "record_feedback"
            ? "feedback"
            : "support",
      knownIssueId: cleanUuid(input.args.knownIssueId),
      product: input.product,
      screen: input.screen,
      sessionId: input.sessionId,
      severity: cleanSeverity(input.args.severity ?? input.args.urgency),
      summary: cleanText(input.args.summary, 2000) ?? "Support case created from Quira chat.",
      tags: cleanTags(input.args.tags),
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
    source: input.user.source,
  });
  const knownIssues = await searchQuiraKnownIssues({
    product: input.product,
    query: input.message,
  });
  const sessionSnapshot = await getSessionSupportSnapshot({
    product: input.product,
    sessionId: input.sessionId,
    userId: input.user.id,
  });
  const productContext = await getProductSupportContext({
    browserContext: input.browserContext,
    product: input.product,
    sessionId: input.sessionId,
    userId: input.user.id,
  });
  const context = supportContext({
    browserContext: input.browserContext,
    knownIssues,
    knowledge,
    product: input.product,
    productContext,
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
            browserContext: input.browserContext,
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

async function saveSupportAttachment(input: {
  caseId: string;
  conversationId: string;
  dataUrl?: string;
  fileName?: string;
  messageId: string;
  mimeType?: string;
  size?: number;
  userId?: string;
}) {
  if (!input.dataUrl) {
    return undefined;
  }

  let parsed: ReturnType<typeof supportAttachmentFromDataUrl>;
  try {
    parsed = supportAttachmentFromDataUrl(input.dataUrl);
  } catch (error) {
    const [attachment] = await getDb()
      .insert(quiraAttachments)
      .values({
        caseId: input.caseId,
        conversationId: input.conversationId,
        errorMessage: error instanceof Error ? error.message : "Attachment parse failed.",
        fileName: input.fileName,
        fileSize: input.size,
        kind: "screenshot",
        messageId: input.messageId,
        mimeType: input.mimeType,
        status: "failed",
        userId: input.userId,
      })
      .returning();

    await recordCaseEvent({
      actorUserId: input.userId,
      caseId: input.caseId,
      eventType: "attachment_failed",
      metadata: { attachmentId: attachment.id, reason: attachment.errorMessage },
    });

    return attachment;
  }

  if (!parsed || !isSupportStorageConfigured()) {
    const [attachment] = await getDb()
      .insert(quiraAttachments)
      .values({
        caseId: input.caseId,
        checksum: parsed?.checksum,
        conversationId: input.conversationId,
        errorMessage: "R2 support attachment storage is not configured.",
        fileName: input.fileName,
        fileSize: parsed?.size ?? input.size,
        kind: "screenshot",
        messageId: input.messageId,
        mimeType: parsed?.mimeType ?? input.mimeType,
        status: "unavailable",
        userId: input.userId,
      })
      .returning();

    await recordCaseEvent({
      actorUserId: input.userId,
      caseId: input.caseId,
      eventType: "attachment_unavailable",
      metadata: { attachmentId: attachment.id },
    });

    return attachment;
  }

  try {
    const uploaded = await uploadSupportAttachment({
      buffer: parsed.buffer,
      conversationId: input.conversationId,
      fileName: input.fileName,
      kind: "screenshot",
      mimeType: parsed.mimeType,
    });
    const [attachment] = await getDb()
      .insert(quiraAttachments)
      .values({
        caseId: input.caseId,
        checksum: parsed.checksum,
        conversationId: input.conversationId,
        fileKey: uploaded.key,
        fileName: input.fileName,
        fileSize: parsed.size,
        kind: "screenshot",
        messageId: input.messageId,
        mimeType: parsed.mimeType,
        publicUrl: uploaded.url,
        status: "uploaded",
        userId: input.userId,
      })
      .returning();

    await recordCaseEvent({
      actorUserId: input.userId,
      caseId: input.caseId,
      eventType: "attachment_added",
      metadata: { attachmentId: attachment.id, fileKey: attachment.fileKey },
    });

    return attachment;
  } catch (error) {
    const [attachment] = await getDb()
      .insert(quiraAttachments)
      .values({
        caseId: input.caseId,
        checksum: parsed.checksum,
        conversationId: input.conversationId,
        errorMessage: error instanceof Error ? error.message : "Attachment upload failed.",
        fileName: input.fileName,
        fileSize: parsed.size,
        kind: "screenshot",
        messageId: input.messageId,
        mimeType: parsed.mimeType,
        status: "failed",
        userId: input.userId,
      })
      .returning();

    await recordCaseEvent({
      actorUserId: input.userId,
      caseId: input.caseId,
      eventType: "attachment_failed",
      metadata: { attachmentId: attachment.id, reason: attachment.errorMessage },
    });

    return attachment;
  }
}

export async function createQuiraSupportReport(
  input: QuiraSupportReportInput,
  user: QuiraChatUser,
) {
  const reportMessage =
    cleanText(input.message, MAX_MESSAGE_LENGTH) ||
    "Support report submitted without text. See metadata for rating/screenshot context.";
  const conversation = await getOrCreateConversation(
    {
      browserContext: input.browserContext,
      conversationId: input.conversationId,
      message: reportMessage,
      product: input.product,
      screen: input.screen,
      sessionId: input.sessionId,
    },
    user,
  );
  const userMessage = await addMessage({
    content: reportMessage,
    conversationId: conversation.id,
    metadata: {
      kind: input.kind,
      rating: input.rating,
      screenshot: {
        mimeType: input.screenshotMimeType,
        name: input.screenshotName,
        size: input.screenshotSize,
        storage: input.screenshotDataUrl ? "pending_attachment_record" : "none",
      },
      source: "quira_report",
    },
    role: "user",
    userId: user.id,
  });

  const supportCase = await createSupportCase({
    conversationId: conversation.id,
    details: {
      browserContext: input.browserContext,
      rating: input.rating,
      screenshot: {
        mimeType: input.screenshotMimeType,
        name: input.screenshotName,
        size: input.screenshotSize,
        storage: input.screenshotDataUrl ? "attachment_record" : "none",
      },
      source: "quira_report",
    },
    kind: input.kind,
    product: input.product,
    screen: input.screen,
    sessionId: input.sessionId,
    summary: reportMessage,
    title:
      input.kind === "bug"
        ? "Bug report from Quira"
        : input.kind === "feedback"
          ? "Feedback from Quira"
          : "Support report from Quira",
    urgency: input.urgency,
    userId: user.id,
  });
  const attachment = await saveSupportAttachment({
    caseId: supportCase.id,
    conversationId: conversation.id,
    dataUrl: input.screenshotDataUrl,
    fileName: input.screenshotName,
    messageId: userMessage.id,
    mimeType: input.screenshotMimeType,
    size: input.screenshotSize,
    userId: user.id,
  });

  return {
    attachmentId: attachment?.id,
    caseId: supportCase.id,
    conversationId: conversation.id,
    messageId: userMessage.id,
    status: supportCase.status,
  };
}

export async function listQuiraAdminSupportData(limit = 100) {
  const [
    cases,
    conversations,
    articles,
    messages,
    leads,
    toolEvents,
    knownIssues,
    caseEvents,
    caseTags,
    attachments,
    answerFeedback,
  ] = await Promise.all([
    getDb()
      .select({
        assignedToUserId: quiraSupportCases.assignedToUserId,
        conversationId: quiraSupportCases.conversationId,
        createdAt: quiraSupportCases.createdAt,
        details: quiraSupportCases.details,
        id: quiraSupportCases.id,
        kind: quiraSupportCases.kind,
        knownIssueId: quiraSupportCases.knownIssueId,
        product: quiraSupportCases.product,
        screen: quiraSupportCases.screen,
        sessionId: quiraSupportCases.sessionId,
        severity: quiraSupportCases.severity,
        status: quiraSupportCases.status,
        summary: quiraSupportCases.summary,
        title: quiraSupportCases.title,
        updatedAt: quiraSupportCases.updatedAt,
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
        audience: quiraKnowledgeArticles.audience,
        category: quiraKnowledgeArticles.category,
        content: quiraKnowledgeArticles.content,
        displayOrder: quiraKnowledgeArticles.displayOrder,
        id: quiraKnowledgeArticles.id,
        product: quiraKnowledgeArticles.product,
        published: quiraKnowledgeArticles.published,
        archivedAt: quiraKnowledgeArticles.archivedAt,
        reviewedAt: quiraKnowledgeArticles.reviewedAt,
        reviewedBy: quiraKnowledgeArticles.reviewedBy,
        reviewStatus: quiraKnowledgeArticles.reviewStatus,
        slug: quiraKnowledgeArticles.slug,
        sourceHash: quiraKnowledgeArticles.sourceHash,
        sourcePath: quiraKnowledgeArticles.sourcePath,
        sourceType: quiraKnowledgeArticles.sourceType,
        tags: quiraKnowledgeArticles.tags,
        title: quiraKnowledgeArticles.title,
        updatedAt: quiraKnowledgeArticles.updatedAt,
        vectorFileId: quiraKnowledgeArticles.vectorFileId,
        vectorSyncError: quiraKnowledgeArticles.vectorSyncError,
        vectorSyncStatus: quiraKnowledgeArticles.vectorSyncStatus,
        vectorSyncedAt: quiraKnowledgeArticles.vectorSyncedAt,
      })
      .from(quiraKnowledgeArticles)
      .orderBy(desc(quiraKnowledgeArticles.updatedAt))
      .limit(limit),
    getDb()
      .select({
        content: quiraMessages.content,
        conversationId: quiraMessages.conversationId,
        createdAt: quiraMessages.createdAt,
        id: quiraMessages.id,
        metadata: quiraMessages.metadata,
        role: quiraMessages.role,
        userEmail: users.email,
        userId: quiraMessages.userId,
      })
      .from(quiraMessages)
      .leftJoin(users, eq(users.id, quiraMessages.userId))
      .orderBy(desc(quiraMessages.createdAt))
      .limit(limit * 4),
    getDb()
      .select({
        conversationId: quiraLeads.conversationId,
        createdAt: quiraLeads.createdAt,
        details: quiraLeads.details,
        email: quiraLeads.email,
        id: quiraLeads.id,
        name: quiraLeads.name,
        productInterest: quiraLeads.productInterest,
        source: quiraLeads.source,
        status: quiraLeads.status,
        summary: quiraLeads.summary,
        updatedAt: quiraLeads.updatedAt,
        userEmail: users.email,
        userId: quiraLeads.userId,
      })
      .from(quiraLeads)
      .leftJoin(users, eq(users.id, quiraLeads.userId))
      .orderBy(desc(quiraLeads.createdAt))
      .limit(limit),
    getDb()
      .select({
        conversationId: quiraToolEvents.conversationId,
        createdAt: quiraToolEvents.createdAt,
        errorMessage: quiraToolEvents.errorMessage,
        id: quiraToolEvents.id,
        input: quiraToolEvents.input,
        output: quiraToolEvents.output,
        status: quiraToolEvents.status,
        toolName: quiraToolEvents.toolName,
      })
      .from(quiraToolEvents)
      .orderBy(desc(quiraToolEvents.createdAt))
      .limit(limit * 2),
    getDb()
      .select({
        adminNotes: quiraKnownIssues.adminNotes,
        affectedScreens: quiraKnownIssues.affectedScreens,
        archivedAt: quiraKnownIssues.archivedAt,
        createdAt: quiraKnownIssues.createdAt,
        fixedAt: quiraKnownIssues.fixedAt,
        id: quiraKnownIssues.id,
        product: quiraKnownIssues.product,
        severity: quiraKnownIssues.severity,
        status: quiraKnownIssues.status,
        summary: quiraKnownIssues.summary,
        title: quiraKnownIssues.title,
        updatedAt: quiraKnownIssues.updatedAt,
        workaround: quiraKnownIssues.workaround,
      })
      .from(quiraKnownIssues)
      .orderBy(desc(quiraKnownIssues.updatedAt))
      .limit(limit),
    getDb()
      .select({
        actorUserId: quiraCaseEvents.actorUserId,
        caseId: quiraCaseEvents.caseId,
        createdAt: quiraCaseEvents.createdAt,
        eventType: quiraCaseEvents.eventType,
        fromStatus: quiraCaseEvents.fromStatus,
        id: quiraCaseEvents.id,
        knownIssueId: quiraCaseEvents.knownIssueId,
        metadata: quiraCaseEvents.metadata,
        note: quiraCaseEvents.note,
        toStatus: quiraCaseEvents.toStatus,
      })
      .from(quiraCaseEvents)
      .orderBy(desc(quiraCaseEvents.createdAt))
      .limit(limit * 2),
    getDb()
      .select({
        caseId: quiraCaseTags.caseId,
        createdAt: quiraCaseTags.createdAt,
        id: quiraCaseTags.id,
        tag: quiraCaseTags.tag,
      })
      .from(quiraCaseTags)
      .orderBy(desc(quiraCaseTags.createdAt))
      .limit(limit * 4),
    getDb()
      .select({
        caseId: quiraAttachments.caseId,
        conversationId: quiraAttachments.conversationId,
        createdAt: quiraAttachments.createdAt,
        errorMessage: quiraAttachments.errorMessage,
        fileKey: quiraAttachments.fileKey,
        fileName: quiraAttachments.fileName,
        fileSize: quiraAttachments.fileSize,
        id: quiraAttachments.id,
        kind: quiraAttachments.kind,
        mimeType: quiraAttachments.mimeType,
        publicUrl: quiraAttachments.publicUrl,
        status: quiraAttachments.status,
      })
      .from(quiraAttachments)
      .orderBy(desc(quiraAttachments.createdAt))
      .limit(limit * 2),
    getDb()
      .select({
        comment: quiraAnswerFeedback.comment,
        conversationId: quiraAnswerFeedback.conversationId,
        createdAt: quiraAnswerFeedback.createdAt,
        id: quiraAnswerFeedback.id,
        messageId: quiraAnswerFeedback.messageId,
        rating: quiraAnswerFeedback.rating,
        userId: quiraAnswerFeedback.userId,
      })
      .from(quiraAnswerFeedback)
      .orderBy(desc(quiraAnswerFeedback.createdAt))
      .limit(limit * 2),
  ]);

  return {
    articles: articles.map((article) => ({
      ...article,
      archivedAt: article.archivedAt?.toISOString(),
      reviewedAt: article.reviewedAt?.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
      vectorSyncedAt: article.vectorSyncedAt?.toISOString(),
    })),
    cases: cases.map((supportCase) => ({
      ...supportCase,
      createdAt: supportCase.createdAt.toISOString(),
      updatedAt: supportCase.updatedAt.toISOString(),
    })),
    conversations: conversations.map((conversation) => ({
      ...conversation,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    })),
    messages: messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    })),
    leads: leads.map((lead) => ({
      ...lead,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    })),
    toolEvents: toolEvents.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
    knownIssues: knownIssues.map((issue) => ({
      ...issue,
      archivedAt: issue.archivedAt?.toISOString(),
      createdAt: issue.createdAt.toISOString(),
      fixedAt: issue.fixedAt?.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
    })),
    caseEvents: caseEvents.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
    caseTags: caseTags.map((tag) => ({
      ...tag,
      createdAt: tag.createdAt.toISOString(),
    })),
    attachments: attachments.map((attachment) => ({
      ...attachment,
      createdAt: attachment.createdAt.toISOString(),
    })),
    answerFeedback: answerFeedback.map((feedback) => ({
      ...feedback,
      createdAt: feedback.createdAt.toISOString(),
    })),
  };
}

function quiraArticleVectorDocument(article: {
  audience: string;
  category: string;
  content: string;
  product: string;
  slug: string;
  sourcePath?: string | null;
  tags: string[];
  title: string;
}) {
  return [
    `# ${article.title}`,
    "",
    `Slug: ${article.slug}`,
    `Product: ${article.product}`,
    `Category: ${article.category}`,
    `Audience: ${article.audience}`,
    article.sourcePath ? `Source: ${article.sourcePath}` : undefined,
    article.tags.length ? `Tags: ${article.tags.join(", ")}` : undefined,
    "",
    article.content,
  ]
    .filter(Boolean)
    .join("\n");
}

function hashQuiraArticle(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

async function openAiJson(input: {
  apiKey: string;
  body?: BodyInit;
  headers?: Record<string, string>;
  method?: string;
  url: string;
}) {
  const response = await fetch(input.url, {
    body: input.body,
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      ...input.headers,
    },
    method: input.method ?? "GET",
  });
  const text = await response.text();
  const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    throw new Error(
      typeof json.error === "object" &&
        json.error &&
        "message" in json.error &&
        typeof json.error.message === "string"
        ? json.error.message
        : `OpenAI request failed with status ${response.status}.`,
    );
  }

  return json;
}

async function detachVectorFile(input: {
  apiKey: string;
  fileId?: string | null;
  vectorStoreId: string;
}) {
  if (!input.fileId) {
    return;
  }

  try {
    await openAiJson({
      apiKey: input.apiKey,
      method: "DELETE",
      url: `https://api.openai.com/v1/vector_stores/${input.vectorStoreId}/files/${input.fileId}`,
    });
  } catch {
    // Stale vector attachments should not block replacing the article document.
  }
}

async function uploadArticleToVectorStore(input: {
  apiKey: string;
  article: {
    audience: string;
    category: string;
    content: string;
    product: string;
    slug: string;
    sourcePath?: string | null;
    tags: string[];
    title: string;
  };
  vectorStoreId: string;
}) {
  const document = quiraArticleVectorDocument(input.article);
  const fileForm = new FormData();
  fileForm.append("purpose", "assistants");
  fileForm.append(
    "file",
    new Blob([document], { type: "text/markdown" }),
    `quira-${input.article.slug}.md`,
  );

  const uploaded = await openAiJson({
    apiKey: input.apiKey,
    body: fileForm,
    method: "POST",
    url: "https://api.openai.com/v1/files",
  });
  const fileId = typeof uploaded.id === "string" ? uploaded.id : undefined;

  if (!fileId) {
    throw new Error("OpenAI did not return a file id for the Quira article.");
  }

  await openAiJson({
    apiKey: input.apiKey,
    body: JSON.stringify({
      attributes: {
        audience: input.article.audience,
        category: input.article.category,
        product: input.article.product,
        slug: input.article.slug,
      },
      file_id: fileId,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    url: `https://api.openai.com/v1/vector_stores/${input.vectorStoreId}/files`,
  });

  return {
    document,
    fileId,
  };
}

export async function syncQuiraKnowledgeToVectorStore() {
  const vectorStoreId = cleanText(process.env.OPENAI_QUIRA_VECTOR_STORE_ID, 160);
  const apiKey = getOpenAiApiKey("support");

  if (!vectorStoreId) {
    throw new Error("OPENAI_QUIRA_VECTOR_STORE_ID is not configured.");
  }

  if (!apiKey) {
    throw new Error("OPENAI_QUIRA_API_KEY or support fallback key is not configured.");
  }

  const articles = await getDb()
    .select({
      audience: quiraKnowledgeArticles.audience,
      category: quiraKnowledgeArticles.category,
      content: quiraKnowledgeArticles.content,
      id: quiraKnowledgeArticles.id,
      product: quiraKnowledgeArticles.product,
      slug: quiraKnowledgeArticles.slug,
      sourceHash: quiraKnowledgeArticles.sourceHash,
      sourcePath: quiraKnowledgeArticles.sourcePath,
      tags: quiraKnowledgeArticles.tags,
      title: quiraKnowledgeArticles.title,
      vectorFileId: quiraKnowledgeArticles.vectorFileId,
      vectorSyncStatus: quiraKnowledgeArticles.vectorSyncStatus,
    })
    .from(quiraKnowledgeArticles)
    .where(
      and(
        eq(quiraKnowledgeArticles.published, true),
        eq(quiraKnowledgeArticles.reviewStatus, "reviewed"),
        isNull(quiraKnowledgeArticles.archivedAt),
      ),
    );
  const summary = {
    failed: 0,
    skipped: 0,
    synced: 0,
    total: articles.length,
  };

  for (const article of articles) {
    const document = quiraArticleVectorDocument(article);
    const sourceHash = hashQuiraArticle(document);

    if (
      article.sourceHash === sourceHash &&
      article.vectorFileId &&
      article.vectorSyncStatus === "synced"
    ) {
      summary.skipped += 1;
      continue;
    }

    try {
      await detachVectorFile({
        apiKey,
        fileId: article.vectorFileId,
        vectorStoreId,
      });
      const uploaded = await uploadArticleToVectorStore({
        apiKey,
        article,
        vectorStoreId,
      });

      await getDb()
        .update(quiraKnowledgeArticles)
        .set({
          sourceHash: hashQuiraArticle(uploaded.document),
          updatedAt: new Date(),
          vectorFileId: uploaded.fileId,
          vectorSyncError: null,
          vectorSyncStatus: "synced",
          vectorSyncedAt: new Date(),
        })
        .where(eq(quiraKnowledgeArticles.id, article.id));
      summary.synced += 1;
    } catch (error) {
      await getDb()
        .update(quiraKnowledgeArticles)
        .set({
          sourceHash,
          updatedAt: new Date(),
          vectorSyncError: error instanceof Error ? error.message : "Vector sync failed.",
          vectorSyncStatus: "failed",
        })
        .where(eq(quiraKnowledgeArticles.id, article.id));
      summary.failed += 1;
    }
  }

  return summary;
}
