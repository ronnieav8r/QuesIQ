import fs from "node:fs";

import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  aiRuns,
  quiraAnswerFeedback,
  quiraAttachments,
  quiraCaseEvents,
  quiraCaseTags,
  quiraConversations,
  quiraKnownIssues,
  quiraKnowledgeArticles,
  quiraLeads,
  quiraMessages,
  quiraSupportCases,
  quiraToolEvents,
  users,
} from "@/server/db/schema";
import {
  getOpenAiQuiraSmokeTestApiKey,
  getOpenAiQuiraSmokeTestApiKeySource,
} from "@/server/openai/keys";
import {
  handleQuiraChat,
  recordQuiraAnswerFeedback,
  saveQuiraKnowledgeArticle,
  saveQuiraKnownIssue,
} from "@/server/support/quira-support";

type SmokeScenario = "public_kb" | "signed_in_bug";

type SmokeResult = {
  conversationId: string;
  label: SmokeScenario;
  replyPreview: string;
  warnings?: string[];
};

const smokeUserId = "quira-chat-smoke-admin";
const smokeUserEmail = "quira-chat-smoke@example.test";
const smokePrefix = "[TEST_DELETE] Quira Chat Smoke";
const smokeArticleSlug = "test-delete-quira-chat-smoke-study-review";

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;

    const envText = fs.readFileSync(file, "utf8");
    for (const line of envText.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;

      const key = match[1];
      let value = match[2].trim();
      if (!value || value.startsWith("#")) continue;

      value = value.replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function preview(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 160);
}

async function cleanupSmokeRows() {
  const db = getDb();
  const conversationRows = await db
    .select({ id: quiraConversations.id })
    .from(quiraConversations)
    .where(eq(quiraConversations.userId, smokeUserId));
  const conversationIds = conversationRows.map((conversation) => conversation.id);
  const supportCaseRows = conversationIds.length
    ? await db
        .select({ id: quiraSupportCases.id })
        .from(quiraSupportCases)
        .where(inArray(quiraSupportCases.conversationId, conversationIds))
    : [];
  const supportCaseIds = supportCaseRows.map((supportCase) => supportCase.id);

  if (supportCaseIds.length > 0) {
    await db.delete(quiraCaseTags).where(inArray(quiraCaseTags.caseId, supportCaseIds));
    await db.delete(quiraCaseEvents).where(inArray(quiraCaseEvents.caseId, supportCaseIds));
    await db.delete(quiraAttachments).where(inArray(quiraAttachments.caseId, supportCaseIds));
  }

  if (conversationIds.length > 0) {
    await db
      .delete(quiraAnswerFeedback)
      .where(inArray(quiraAnswerFeedback.conversationId, conversationIds));
    await db.delete(quiraToolEvents).where(inArray(quiraToolEvents.conversationId, conversationIds));
    await db.delete(quiraLeads).where(inArray(quiraLeads.conversationId, conversationIds));
    await db.delete(quiraSupportCases).where(inArray(quiraSupportCases.conversationId, conversationIds));
    await db.delete(quiraMessages).where(inArray(quiraMessages.conversationId, conversationIds));
    await db.delete(quiraConversations).where(inArray(quiraConversations.id, conversationIds));
  }

  await db.delete(aiRuns).where(eq(aiRuns.userId, smokeUserId));
  await db.delete(quiraKnownIssues).where(eq(quiraKnownIssues.createdByUserId, smokeUserId));
  await db.delete(quiraKnowledgeArticles).where(eq(quiraKnowledgeArticles.slug, smokeArticleSlug));
  await db.delete(users).where(eq(users.id, smokeUserId));
}

async function prepareSmokeData() {
  const db = getDb();

  await db
    .insert(users)
    .values({
      email: smokeUserEmail,
      id: smokeUserId,
      name: "Quira Chat Smoke",
    })
    .onConflictDoNothing();

  await saveQuiraKnowledgeArticle({
    audience: "public",
    category: "study",
    content:
      "Smoke test article: Study reviews appear after a practice set is submitted. If a review is missing, ask the learner to refresh the page and check History. If it is still missing, create a support case with the deck, screen, and approximate time.",
    product: "study",
    published: true,
    reviewStatus: "reviewed",
    slug: smokeArticleSlug,
    tags: ["smoke", "study", "review"],
    title: `${smokePrefix} Study Review Help`,
    userId: smokeUserId,
  });

  await saveQuiraKnownIssue({
    affectedScreens: ["study-review", "study-history"],
    adminNotes: "Disposable smoke known issue.",
    product: "study",
    severity: "normal",
    status: "open",
    summary:
      "Smoke test known issue: a Study review can take a short time to appear after a submitted practice set.",
    title: `${smokePrefix} Study Review Delay`,
    userId: smokeUserId,
    workaround: "Refresh the page and check Study History before filing a support case.",
  });
}

async function assertConversation(conversationId: string, label: SmokeScenario) {
  const messages = await getDb()
    .select({
      content: quiraMessages.content,
      role: quiraMessages.role,
    })
    .from(quiraMessages)
    .where(eq(quiraMessages.conversationId, conversationId));

  assert(messages.some((message) => message.role === "user"), `${label}: expected user messages.`);
  assert(
    messages.some((message) => message.role === "assistant" && message.content.trim()),
    `${label}: expected an assistant reply.`,
  );
}

async function assertAiRun(label: SmokeScenario) {
  const rows = await getDb()
    .select({
      providerRequestId: aiRuns.providerRequestId,
      status: aiRuns.status,
      totalTokens: aiRuns.totalTokens,
    })
    .from(aiRuns)
    .where(and(eq(aiRuns.userId, smokeUserId), eq(aiRuns.runType, "quira_support")));

  assert(rows.length > 0, `${label}: expected at least one quira_support ai_runs row.`);
  const succeeded = rows.find((row) => row.status === "succeeded");
  assert(succeeded, `${label}: expected a succeeded quira_support ai_runs row.`);
  assert(succeeded.providerRequestId, `${label}: expected provider request id.`);
  assert(succeeded.totalTokens && succeeded.totalTokens > 0, `${label}: expected token usage.`);
}

async function listToolEvents(conversationId: string) {
  return getDb()
    .select({
      status: quiraToolEvents.status,
      toolName: quiraToolEvents.toolName,
    })
    .from(quiraToolEvents)
    .where(eq(quiraToolEvents.conversationId, conversationId));
}

async function assertToolEvent(conversationId: string, label: SmokeScenario) {
  const rows = await listToolEvents(conversationId);
  assert(rows.length > 0, `${label}: expected at least one Quira tool event.`);
  assert(
    rows.some((row) => row.status === "succeeded"),
    `${label}: expected at least one successful Quira tool event.`,
  );
}

async function listSupportCases(conversationId: string) {
  return getDb()
    .select({
      kind: quiraSupportCases.kind,
      status: quiraSupportCases.status,
      title: quiraSupportCases.title,
    })
    .from(quiraSupportCases)
    .where(eq(quiraSupportCases.conversationId, conversationId));
}

async function assertSupportCase(conversationId: string, label: SmokeScenario) {
  const rows = await listSupportCases(conversationId);
  assert(rows.length > 0, `${label}: expected Quira to create a support case.`);
  assert(rows.some((row) => row.kind === "bug"), `${label}: expected a bug support case.`);
}

async function runPublicKbSmoke(): Promise<SmokeResult> {
  const first = await handleQuiraChat(
    {
      browserContext: {
        pathname: "/study/decks/smoke/study",
        viewport: "1280x800",
      },
      message:
        "I just finished a Study practice set and my review is missing. What should I try first?",
      product: "study",
      screen: "study-review",
      source: "public",
    },
    {
      id: smokeUserId,
      name: "Quira Chat Smoke",
      source: "public",
    },
  );

  assert(first.conversationId, "public_kb: expected a conversation id.");
  assert(first.message.content.trim(), "public_kb: expected first assistant reply.");

  const second = await handleQuiraChat(
    {
      browserContext: {
        pathname: "/study/decks/smoke/study",
        viewport: "1280x800",
      },
      conversationId: first.conversationId,
      message: "Should I file a support case right away?",
      product: "study",
      screen: "study-review",
      source: "public",
    },
    {
      id: smokeUserId,
      name: "Quira Chat Smoke",
      source: "public",
    },
  );

  assert(second.conversationId === first.conversationId, "public_kb: expected multi-turn reuse.");
  await assertConversation(first.conversationId, "public_kb");

  return {
    conversationId: first.conversationId,
    label: "public_kb",
    replyPreview: preview(second.message.content),
  };
}

async function runSignedInBugSmoke(strict: boolean): Promise<SmokeResult> {
  const result = await handleQuiraChat(
    {
      browserContext: {
        contextDetails: { smoke: true },
        pathname: "/study/decks/smoke/study",
        timeZone: "America/New_York",
        viewport: "1440x900",
      },
      message:
        "Bug report: my Study review still has not appeared after refreshing twice. Please create a support case for the admin team.",
      product: "study",
      screen: "study-review",
      source: "signed_in",
    },
    {
      email: smokeUserEmail,
      id: smokeUserId,
      name: "Quira Chat Smoke",
      source: "signed_in",
    },
  );

  assert(result.conversationId, "signed_in_bug: expected a conversation id.");
  assert(result.message.id, "signed_in_bug: expected an assistant message id.");
  assert(result.message.content.trim(), "signed_in_bug: expected assistant reply.");
  await assertConversation(result.conversationId, "signed_in_bug");
  const toolEvents = await listToolEvents(result.conversationId);
  const supportCases = await listSupportCases(result.conversationId);
  const warnings: string[] = [];

  if (strict) {
    await assertToolEvent(result.conversationId, "signed_in_bug");
    await assertSupportCase(result.conversationId, "signed_in_bug");
  } else {
    if (toolEvents.length === 0) {
      warnings.push("Quira answered the bug report without recording a tool event.");
    }
    if (supportCases.length === 0) {
      warnings.push("Quira answered the bug report without creating a support case.");
    } else if (!supportCases.some((supportCase) => supportCase.kind === "bug")) {
      warnings.push("Quira created a support case, but did not classify it as a bug case.");
    }
  }

  await recordQuiraAnswerFeedback({
    conversationId: result.conversationId,
    messageId: result.message.id,
    rating: "helpful",
    userId: smokeUserId,
  });

  const feedback = await getDb()
    .select({ id: quiraAnswerFeedback.id })
    .from(quiraAnswerFeedback)
    .where(eq(quiraAnswerFeedback.conversationId, result.conversationId));
  assert(feedback.length > 0, "signed_in_bug: expected answer feedback to persist.");

  return {
    conversationId: result.conversationId,
    label: "signed_in_bug",
    replyPreview: preview(result.message.content),
    warnings,
  };
}

async function printFailureSummary() {
  const rows = await getDb()
    .select({
      errorMessage: aiRuns.errorMessage,
      model: aiRuns.model,
      rawJson: aiRuns.rawJson,
      status: aiRuns.status,
    })
    .from(aiRuns)
    .where(eq(aiRuns.userId, smokeUserId));

  const failedRows = rows.filter((row) => row.status === "failed");
  if (failedRows.length === 0) return;

  console.error("Sanitized failed Quira ai_runs summary:");
  for (const row of failedRows) {
    const status =
      row.rawJson && typeof row.rawJson === "object" && "status" in row.rawJson
        ? String(row.rawJson.status)
        : "unknown";
    console.error(
      `- model=${row.model} providerStatus=${status} error=${row.errorMessage ?? "n/a"}`,
    );
  }
}

async function main() {
  loadLocalEnv();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for Quira chat smoke tests.");
  }

  const apiKey = getOpenAiQuiraSmokeTestApiKey();
  const keySource = getOpenAiQuiraSmokeTestApiKeySource();
  assert(
    apiKey,
    "OPENAI_QUIRA_TEST_TUNNEL_API_KEY, OPENAI_QUIRA_API_KEY, OPENAI_SUPPORT_API_KEY, OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY, or OPENAI_API_KEY is required.",
  );
  if (!process.env.OPENAI_QUIRA_API_KEY && !process.env.OPENAI_SUPPORT_API_KEY) {
    process.env.OPENAI_QUIRA_API_KEY = apiKey;
  }

  const scenarioArg = process.argv.find((argument) => argument.startsWith("--scenario="));
  const scenarioFilter = scenarioArg?.split("=")[1] as SmokeScenario | undefined;
  const strict = process.argv.includes("--strict");
  const scenarioRunners: Record<SmokeScenario, () => Promise<SmokeResult>> = {
    public_kb: runPublicKbSmoke,
    signed_in_bug: () => runSignedInBugSmoke(strict),
  };
  assert(
    !scenarioFilter || scenarioFilter in scenarioRunners,
    "Unknown Quira smoke scenario. Use --scenario=public_kb or --scenario=signed_in_bug.",
  );

  await cleanupSmokeRows();
  await prepareSmokeData();

  const selectedScenarios = scenarioFilter
    ? [scenarioFilter]
    : (Object.keys(scenarioRunners) as SmokeScenario[]);
  const results: SmokeResult[] = [];

  try {
    for (const scenario of selectedScenarios) {
      console.log(`Running Quira smoke scenario: ${scenario}`);
      results.push(await scenarioRunners[scenario]());
    }
    await assertAiRun(selectedScenarios[selectedScenarios.length - 1]);
  } catch (error) {
    await printFailureSummary();
    throw error;
  } finally {
    await cleanupSmokeRows();
  }

  console.log(`Quira chat smoke passed. keySource=${keySource}`);
  for (const result of results) {
    console.log(
      `- ${result.label}: conversation=${result.conversationId} reply="${result.replyPreview}"`,
    );
    for (const warning of result.warnings ?? []) {
      console.log(`  warning: ${warning}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
