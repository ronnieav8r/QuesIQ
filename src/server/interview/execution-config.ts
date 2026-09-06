import { interviewExecutionConfigSchema, interviewRuntimeSettingsSchema } from "@quesiq/interview-contracts";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { PromptConfigKey, SessionSetupSnapshot } from "@/product/interview-types";
import { getSessionPromptComponents } from "@/server/catalog/get-session-prompt-components";
import { getDb } from "@/server/db/client";
import { practiceModes, sessions } from "@/server/db/schema";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";
import { CoachingOperationError } from "./coaching-operations";
import { buildInterviewExecutionConfig } from "./execution-config-builder";
import { getInterviewRuntimeConfig } from "./runtime-configs";

/** Resolve only trusted, parsed setup. The caller never supplies execution metadata. */
export async function resolveInterviewExecutionSnapshot(snapshot: SessionSetupSnapshot, surface: "native" | "inspector") {
  if (!["coaching", "rapid_fire", "mock_interview", "first_impression"].includes(snapshot.modeKey)) {
    throw new CoachingOperationError("unsupported_mode", "This mode is not available in the mobile app.", 400);
  }
  const { updatedAt: _updatedAt, ...runtime } = await getInterviewRuntimeConfig(snapshot.modeKey);
  void _updatedAt;
  const configured = interviewRuntimeSettingsSchema.parse(runtime);
  const keys: PromptConfigKey[] = snapshot.modeKey === "coaching"
    ? ["turn_question_planner", "turn_coaching_responder"]
    : ["realtime_interviewer", ...(snapshot.storyContext ? ["story_practice_realtime" as const] : [])];
  // Strip old pins when explicitly resolving; component lookup must read current catalog here.
  const unpinned = { ...snapshot, executionConfig: undefined, executionPromptSnapshot: undefined };
  const [catalog, configs, components] = await Promise.all([
    getDb().select({ enabled: practiceModes.enabled }).from(practiceModes).where(eq(practiceModes.key, snapshot.modeKey)).limit(1),
    Promise.all(keys.map(getActivePromptConfig)),
    getSessionPromptComponents(unpinned),
  ]);
  const executionConfig = buildInterviewExecutionConfig({
    surface, configured, catalogEnabled: catalog[0]?.enabled === true,
    realtimePrompt: configs.find((item) => item.key === (snapshot.storyContext ? "story_practice_realtime" : "realtime_interviewer")),
    promptVersions: configs.map(({ key, version }) => ({ key, version })),
  });
  if (!executionConfig.effective.enabled) throw new CoachingOperationError("mode_disabled", "This practice mode is currently unavailable.", 403);
  return { ...unpinned, executionConfig, executionPromptSnapshot: { configs, components } } satisfies SessionSetupSnapshot;
}

export async function getExecutionPrompt(snapshot: SessionSetupSnapshot | undefined, key: PromptConfigKey) {
  if (!snapshot?.executionConfig) return getActivePromptConfig(key);
  const pinned = snapshot.executionPromptSnapshot?.configs.find((item) => item.key === key);
  if (!pinned) throw new CoachingOperationError("configuration_incomplete", "The saved prompt configuration is incomplete.", 409);
  return pinned;
}

/** Legacy sessions pin once; concurrent callers use the winner, never a losing local resolution. */
export async function ensureNativeExecutionSnapshot(sessionId: string, userId: string): Promise<SessionSetupSnapshot> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    throw new CoachingOperationError("session_not_found", "Session was not found.", 404);
  }
  const read = async () => (await getDb().select().from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId))).limit(1))[0];
  const session = await read();
  if (!session) throw new CoachingOperationError("session_not_found", "Session was not found.", 404);
  if (session.endedAt) throw new CoachingOperationError("session_ended", "This session has ended.");
  if (session.contextSnapshot.executionConfig) {
    interviewExecutionConfigSchema.parse(session.contextSnapshot.executionConfig);
    if (!session.contextSnapshot.executionPromptSnapshot || !session.contextSnapshot.executionConfig.effective.enabled) {
      throw new CoachingOperationError("configuration_incomplete", "The saved execution configuration is unavailable.");
    }
    return session.contextSnapshot;
  }
  const resolved = await resolveInterviewExecutionSnapshot(session.contextSnapshot, "native");
  const [saved] = await getDb().update(sessions).set({ contextSnapshot: resolved, updatedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isNull(sessions.endedAt),
      sql`(${sessions.contextSnapshot}->>'executionConfig') IS NULL`))
    .returning({ snapshot: sessions.contextSnapshot });
  if (saved) return saved.snapshot;
  const winner = await read();
  if (winner?.endedAt) throw new CoachingOperationError("session_ended", "This session has ended.");
  if (!winner?.contextSnapshot.executionConfig) throw new CoachingOperationError("configuration_conflict", "Session configuration changed. Retry the request.");
  return winner.contextSnapshot;
}
