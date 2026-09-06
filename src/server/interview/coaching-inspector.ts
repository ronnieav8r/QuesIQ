import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { aiRuns, interviewCoachingInspections as inspections } from "@/server/db/schema";
import { getProfile } from "@/server/profiles/get-profile";
import { operationHistory } from "./chained-coaching-service";
import { planLegacyCoachingTurn } from "./coaching-exercise-adapter";
import { generateControlledCoachingTurn } from "./controlled-coaching-turn";
import { resolveInterviewExecutionSnapshot } from "./execution-config";
import { CoachingOperationError, listCoachingOperations, runCoachingOperation } from "./coaching-operations";
import type { InterviewRuntimeConfigRecord } from "./runtime-configs";

export const inspectorActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), execution: z.enum(["simulation", "live_text"]), usePersonalContext: z.boolean().default(false),
    context: z.object({ preferredName: z.string().max(100), targetRole: z.string().max(200), targetCompany: z.string().max(200), jobDescription: z.string().max(12000) }),
    confirmLive: z.boolean().optional(),
  }).strict(),
  z.object({ action: z.literal("turn"), id: z.string().uuid(), turnIndex: z.number().int().min(0).max(50), answer: z.string().trim().max(12000).optional(),
    choice: z.enum(["more_feedback", "try_again", "ask_que", "move_on"]).optional(), confirmLive: z.boolean().optional(),
    simulateFailure: z.boolean().optional(),
  }).strict(),
  z.object({ action: z.literal("end"), id: z.string().uuid() }).strict(),
]);

async function ownedInspection(id: string, userId: string) {
  const [run] = await getDb().select().from(inspections).where(and(eq(inspections.id, id), eq(inspections.userId, userId)));
  if (!run) throw new CoachingOperationError("not_found", "Test run was not found.", 404);
  return run;
}

export async function readCoachingInspection(userId: string, id: string) {
  const run = await ownedInspection(id, userId);
  const turns = await listCoachingOperations(id, userId);
  return { ...run, turns };
}

export async function listCoachingInspections(userId: string) {
  return getDb().select({ id: inspections.id, execution: inspections.execution, status: inspections.status, createdAt: inspections.createdAt }).from(inspections)
    .where(eq(inspections.userId, userId)).orderBy(desc(inspections.createdAt)).limit(50);
}

export async function executeInspectorAction(userId: string, body: z.infer<typeof inspectorActionSchema>) {
  if (body.action === "create") {
    if (body.execution === "live_text" && (!body.confirmLive || process.env.E2E_TEST_MODE === "1")) throw new CoachingOperationError("live_confirmation", "Live text must be explicitly enabled outside automated tests.", 400);
    const profile = body.usePersonalContext ? await getProfile(userId) : undefined;
    if (body.usePersonalContext && !profile) throw new CoachingOperationError("profile_missing", "No current profile is available.", 400);
    const snapshot = await resolveInterviewExecutionSnapshot({ modeKey: "coaching", questionTypeKey: "behavioral", styleKey: "friendly", interviewContext: profile ?? body.context }, "inspector");
    const [run] = await getDb().insert(inspections).values({ userId, execution: body.execution, usePersonalContext: body.usePersonalContext,
      snapshot,
      config: { ...snapshot.executionConfig.effective, executionConfig: snapshot.executionConfig },
    }).returning();
    return { ...run, turns: [] };
  }
  let run = await ownedInspection(body.id, userId);
  if (body.action === "end") {
    await getDb().update(inspections).set({ status: "ended" }).where(eq(inspections.id, run.id));
    return readCoachingInspection(userId, run.id);
  }
  if (run.status !== "active") throw new CoachingOperationError("run_ended", "This test run has ended.");
  if (run.execution === "live_text" && (!body.confirmLive || process.env.E2E_TEST_MODE === "1")) throw new CoachingOperationError("live_confirmation", "Live text requires explicit confirmation.", 400);
  if (run.execution === "simulation" && body.simulateFailure) throw new CoachingOperationError("simulated_failure", "Simulated connection failure. Retry this same turn.", 503);
  if (!run.snapshot.executionConfig) {
    const snapshot = await resolveInterviewExecutionSnapshot(run.snapshot, "inspector");
    await getDb().update(inspections).set({ snapshot, config: { ...snapshot.executionConfig.effective, executionConfig: snapshot.executionConfig } })
      .where(and(eq(inspections.id, run.id), eq(inspections.userId, userId), eq(inspections.status, "active"), sql`(${inspections.snapshot}->>'executionConfig') IS NULL`));
    run = await ownedInspection(body.id, userId);
    if (run.status !== "active") throw new CoachingOperationError("run_ended", "This test run has ended.");
  }
  const rows = await listCoachingOperations(run.id, userId);
  const config = run.snapshot.executionConfig?.effective ?? run.config as InterviewRuntimeConfigRecord;
  const plan = () => planLegacyCoachingTurn({ rows, turnIndex: body.turnIndex, answer: body.answer, choice: body.choice,
    limit: Math.min(run.snapshot.turnBasedQuestionCount ?? config.maxTurns, config.maxTurns) });
  await runCoachingOperation({ targetId: run.id, userId, turnIndex: body.turnIndex, parent: "inspection", payload: { answer: body.answer, choice: body.choice },
    validate: () => { plan(); },
    generate: async () => {
      const started = Date.now();
      const decision = await generateControlledCoachingTurn({ control: plan(), config,
        inspectionId: run.id, simulation: run.execution === "simulation", usePersonalContext: run.usePersonalContext,
        answer: body.answer, choice: body.choice,
        priorTurns: operationHistory(rows.filter((row) => row.turnIndex < body.turnIndex)),
        snapshot: run.snapshot, turnIndex: body.turnIndex, userId,
      });
      const [usage] = decision.inspection ? await getDb().select({ inputTokens: aiRuns.inputTokens, outputTokens: aiRuns.outputTokens, estimatedCostMicroUsd: aiRuns.estimatedCostMicroUsd }).from(aiRuns)
        .where(eq(aiRuns.id, decision.inspection.aiRunId)) : [];
      return { ...decision, transcript: body.answer, choice: body.choice, durationMs: Date.now() - started, usage,
        validation: decision.validation ?? { corrected: false, issues: [], passed: true } };
    },
  });
  return readCoachingInspection(userId, run.id);
}

export function safeInspectionExport(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value.replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED]").replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
  if (Array.isArray(value)) return value.map(safeInspectionExport);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !/^(authorization|apiKey|accessToken|refreshToken|password)$/i.test(key)).map(([key, item]) => [key, safeInspectionExport(item)]));
  return value;
}

export function coachingInspectionCsv(run: Awaited<ReturnType<typeof readCoachingInspection>>) {
  const cell = (value: unknown) => {
    let text = typeof value === "object" ? JSON.stringify(safeInspectionExport(value)) : String(safeInspectionExport(value ?? ""));
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [["run_id", "execution", "turn", "status", "input", "choice", "question", "feedback", "validation", "original", "delivered", "model", "duration_ms", "usage", "exercise_state", "execution_config"],
    ...run.turns.map((turn) => {
      const r = turn.result ?? {}; const trace = r.inspection as Record<string, unknown> | undefined;
      return [run.id, run.execution, turn.turnIndex, turn.status, r.transcript, r.choice, r.question, r.feedback, r.validation, trace?.original, trace?.delivered ?? r, trace?.model, r.durationMs, r.usage, r.exerciseState, run.snapshot.executionConfig];
    }),
  ].map((row) => row.map(cell).join(",")).join("\r\n");
}
