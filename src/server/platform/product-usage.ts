import { sql } from "drizzle-orm";

import type { PlatformProductKey } from "@/features/platform/products";
import { getDb } from "@/server/db/client";
import { platformProductUsage, platformUsageEvents } from "@/server/db/schema";

const productKeys = new Set<PlatformProductKey>(["dpe", "interview", "study"]);
const eventTypes = new Set(["app_close", "app_open", "heartbeat"]);
const maxHeartbeatSeconds = 300;

type ProductUsageEventType = "app_close" | "app_open" | "heartbeat";

export type ProductUsageInput = {
  activeSeconds: number;
  browserContext: Record<string, unknown>;
  eventType: ProductUsageEventType;
  productKey: PlatformProductKey;
};

function cleanProductKey(value: unknown): PlatformProductKey | undefined {
  return typeof value === "string" && productKeys.has(value as PlatformProductKey)
    ? (value as PlatformProductKey)
    : undefined;
}

function cleanEventType(value: unknown): ProductUsageEventType {
  return typeof value === "string" && eventTypes.has(value)
    ? (value as ProductUsageEventType)
    : "heartbeat";
}

function cleanActiveSeconds(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(maxHeartbeatSeconds, Math.round(value)));
}

function cleanBrowserContext(value: unknown) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const candidate = value as Record<string, unknown>;

  return {
    pathname: typeof candidate.pathname === "string" ? candidate.pathname.slice(0, 200) : undefined,
    visibility:
      typeof candidate.visibility === "string" ? candidate.visibility.slice(0, 40) : undefined,
    viewport: typeof candidate.viewport === "string" ? candidate.viewport.slice(0, 80) : undefined,
  };
}

export function parseProductUsageInput(body: unknown): ProductUsageInput | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const candidate = body as Record<string, unknown>;
  const productKey = cleanProductKey(candidate.productKey);

  if (!productKey) {
    return undefined;
  }

  return {
    activeSeconds: cleanActiveSeconds(candidate.activeSeconds),
    browserContext: cleanBrowserContext(candidate.browserContext),
    eventType: cleanEventType(candidate.eventType),
    productKey,
  };
}

export async function recordProductUsage(userId: string, input: ProductUsageInput) {
  const now = new Date();
  const sessionCountDelta = input.eventType === "app_open" ? 1 : 0;

  await getDb().insert(platformUsageEvents).values({
    activeSeconds: input.activeSeconds,
    browserContext: input.browserContext,
    eventType: input.eventType,
    productKey: input.productKey,
    userId,
  });

  const [summary] = await getDb()
    .insert(platformProductUsage)
    .values({
      firstUsedAt: now,
      lastUsedAt: now,
      productKey: input.productKey,
      sessionCount: sessionCountDelta,
      totalActiveSeconds: input.activeSeconds,
      updatedAt: now,
      userId,
    })
    .onConflictDoUpdate({
      set: {
        lastUsedAt: now,
        sessionCount: sql`${platformProductUsage.sessionCount} + ${sessionCountDelta}`,
        totalActiveSeconds: sql`${platformProductUsage.totalActiveSeconds} + ${input.activeSeconds}`,
        updatedAt: now,
      },
      target: [platformProductUsage.userId, platformProductUsage.productKey],
    })
    .returning({
      lastUsedAt: platformProductUsage.lastUsedAt,
      productKey: platformProductUsage.productKey,
      sessionCount: platformProductUsage.sessionCount,
      totalActiveSeconds: platformProductUsage.totalActiveSeconds,
      userId: platformProductUsage.userId,
    });

  return summary;
}
