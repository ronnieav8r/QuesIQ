import { desc, eq } from "drizzle-orm";

import type {
  DiagnosticEventRecord,
  DiagnosticEventSeverity,
  DiagnosticEventSource,
} from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { diagnosticEvents, users } from "@/server/db/schema";

type CreateDiagnosticEventInput = {
  durationMs?: number;
  endpoint?: string;
  eventType: string;
  message?: string;
  metadata?: Record<string, unknown>;
  method?: string;
  route?: string;
  screen?: string;
  sessionId?: string;
  severity: DiagnosticEventSeverity;
  source: DiagnosticEventSource;
  statusCode?: number;
  userAgent?: string;
  userId?: string;
  viewport?: string;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function cleanNumber(value: unknown, max = 999999) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(Math.round(value), max)
    : undefined;
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

function cleanMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const safeEntries = Object.entries(value as Record<string, unknown>)
    .slice(0, 20)
    .map(([key, entryValue]) => {
      if (
        typeof entryValue === "string" ||
        typeof entryValue === "number" ||
        typeof entryValue === "boolean"
      ) {
        return [key.slice(0, 80), String(entryValue).slice(0, 500)];
      }

      if (entryValue === null) {
        return [key.slice(0, 80), null];
      }

      return [key.slice(0, 80), "[object]"];
    });

  return Object.fromEntries(safeEntries);
}

export function parseDiagnosticEventInput(
  body: unknown,
): Omit<CreateDiagnosticEventInput, "userId"> | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const candidate = body as Record<string, unknown>;
  const severity =
    candidate.severity === "info" ||
    candidate.severity === "warning" ||
    candidate.severity === "error"
      ? candidate.severity
      : undefined;
  const source =
    candidate.source === "api" ||
    candidate.source === "client" ||
    candidate.source === "realtime"
      ? candidate.source
      : undefined;
  const eventType = cleanText(candidate.eventType, 120);

  if (!severity || !source || !eventType) {
    return undefined;
  }

  return {
    durationMs: cleanNumber(candidate.durationMs),
    endpoint: cleanText(candidate.endpoint, 300),
    eventType,
    message: cleanText(candidate.message, 1000),
    metadata: cleanMetadata(candidate.metadata),
    method: cleanText(candidate.method, 16),
    route: cleanText(candidate.route, 300),
    screen: cleanText(candidate.screen, 80),
    sessionId: cleanUuid(candidate.sessionId),
    severity,
    source,
    statusCode: cleanNumber(candidate.statusCode, 599),
    userAgent: cleanText(candidate.userAgent, 500),
    viewport: cleanText(candidate.viewport, 80),
  };
}

function toRecord(row: {
  createdAt: Date;
  durationMs: number | null;
  endpoint: string | null;
  eventType: string;
  id: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  method: string | null;
  route: string | null;
  screen: string | null;
  sessionId: string | null;
  severity: DiagnosticEventSeverity;
  source: DiagnosticEventSource;
  statusCode: number | null;
  userAgent: string | null;
  userEmail?: string | null;
  userId: string | null;
  viewport: string | null;
}): DiagnosticEventRecord {
  return {
    createdAt: row.createdAt.toISOString(),
    durationMs: row.durationMs ?? undefined,
    endpoint: row.endpoint ?? undefined,
    eventType: row.eventType,
    id: row.id,
    message: row.message ?? undefined,
    metadata: row.metadata ?? undefined,
    method: row.method ?? undefined,
    route: row.route ?? undefined,
    screen: row.screen ?? undefined,
    sessionId: row.sessionId ?? undefined,
    severity: row.severity,
    source: row.source,
    statusCode: row.statusCode ?? undefined,
    userAgent: row.userAgent ?? undefined,
    userEmail: row.userEmail ?? undefined,
    userId: row.userId ?? undefined,
    viewport: row.viewport ?? undefined,
  };
}

export async function createDiagnosticEvent(input: CreateDiagnosticEventInput) {
  await getDb().insert(diagnosticEvents).values({
    durationMs: input.durationMs,
    endpoint: input.endpoint,
    eventType: input.eventType,
    message: input.message,
    metadata: input.metadata,
    method: input.method,
    route: input.route,
    screen: input.screen,
    sessionId: input.sessionId,
    severity: input.severity,
    source: input.source,
    statusCode: input.statusCode,
    userAgent: input.userAgent,
    userId: input.userId,
    viewport: input.viewport,
  });
}

export async function listDiagnosticEvents(limit = 150): Promise<DiagnosticEventRecord[]> {
  const rows = await getDb()
    .select({
      createdAt: diagnosticEvents.createdAt,
      durationMs: diagnosticEvents.durationMs,
      endpoint: diagnosticEvents.endpoint,
      eventType: diagnosticEvents.eventType,
      id: diagnosticEvents.id,
      message: diagnosticEvents.message,
      metadata: diagnosticEvents.metadata,
      method: diagnosticEvents.method,
      route: diagnosticEvents.route,
      screen: diagnosticEvents.screen,
      sessionId: diagnosticEvents.sessionId,
      severity: diagnosticEvents.severity,
      source: diagnosticEvents.source,
      statusCode: diagnosticEvents.statusCode,
      userAgent: diagnosticEvents.userAgent,
      userEmail: users.email,
      userId: diagnosticEvents.userId,
      viewport: diagnosticEvents.viewport,
    })
    .from(diagnosticEvents)
    .leftJoin(users, eq(users.id, diagnosticEvents.userId))
    .orderBy(desc(diagnosticEvents.createdAt))
    .limit(limit);

  return rows.map(toRecord);
}
