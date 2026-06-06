import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import { getInterviewRuntimeConfig } from "@/server/interview/runtime-configs";
import { getOpenAiInterviewTestTunnelApiKeySource } from "@/server/openai/keys";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());
  const apiKeySource = getOpenAiInterviewTestTunnelApiKeySource();
  const modes: Record<string, { enabled: boolean; engine: string; textModel: string }> = {};
  const prompts: Record<string, { active: boolean; model: string; version: number }> = {};
  const blockers: string[] = [];

  if (!databaseConfigured) {
    blockers.push("DATABASE_URL is not configured.");
  } else {
    try {
      const [coaching, rapidFire, introPractice] = await Promise.all([
        getInterviewRuntimeConfig("coaching"),
        getInterviewRuntimeConfig("rapid_fire"),
        getInterviewRuntimeConfig("first_impression"),
      ]);

      for (const config of [coaching, rapidFire, introPractice]) {
        modes[config.modeKey] = {
          enabled: config.enabled,
          engine: config.engine,
          textModel: config.textModel,
        };

        if (!config.enabled || config.engine !== "turn_based") {
          blockers.push(`${config.modeKey} is not enabled for turn-based typed testing.`);
        }
      }

      const [planner, responder, router] = await Promise.all([
        getActivePromptConfig("turn_question_planner"),
        getActivePromptConfig("turn_coaching_responder"),
        getActivePromptConfig("turn_choice_router"),
      ]);

      for (const prompt of [planner, responder, router]) {
        prompts[prompt.key] = {
          active: prompt.active,
          model: prompt.model,
          version: prompt.version,
        };
      }
    } catch (error) {
      blockers.push(error instanceof Error ? error.message : "Database readiness check failed.");
    }
  }

  if (!apiKeySource) {
    blockers.push(
      "OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY or an accepted OpenAI fallback key is not configured.",
    );
  }

  return NextResponse.json({
    apiKeySource: apiKeySource ?? null,
    blockers,
    databaseConfigured,
    modes,
    prompts,
    ready: blockers.length === 0,
  });
}
