import { NextResponse } from "next/server";

import type { PromptConfigKey, PromptConfigTarget } from "@/product/interview-types";
import { requireAdminSession } from "@/server/admin";
import {
  activatePromptConfig,
  createPromptConfigVersion,
  listPromptConfigs,
} from "@/server/prompts/prompt-configs";
import { isPromptConfigKey } from "@/server/prompts/defaults";

export const runtime = "nodejs";

type CreateBody = {
  activate?: boolean;
  instructions?: string;
  key?: string;
  model?: string;
  name?: string;
  target?: PromptConfigTarget;
  voice?: string;
};

type ActivateBody = {
  id?: string;
};

function targetForKey(key: PromptConfigKey): PromptConfigTarget {
  if (key === "quira_support_chat") {
    return "support";
  }

  if (key === "session_debrief") {
    return "debrief";
  }

  if (key === "realtime_interviewer" || key === "story_practice_realtime") {
    return "realtime";
  }

  if (
    key === "turn_choice_router" ||
    key === "turn_coaching_responder" ||
    key === "turn_question_planner"
  ) {
    return "turn_based";
  }

  if (
    key === "introduction_draft" ||
    key === "story_conversation_realtime" ||
    key === "story_follow_up" ||
    key === "story_outline"
  ) {
    return "story";
  }

  return "evaluation";
}

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const configs = await listPromptConfigs();

    return NextResponse.json({ configs });
  } catch (error) {
    console.error("Prompt config list failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load prompt configs.",
        error: "Prompt configs could not be loaded.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json()) as CreateBody;

  if (!isPromptConfigKey(body.key)) {
    return NextResponse.json({ error: "Prompt config key is invalid." }, { status: 400 });
  }

  try {
    const config = await createPromptConfigVersion(
      {
        activate: Boolean(body.activate),
        instructions: body.instructions || "",
        key: body.key,
        model: body.model || "",
        name: body.name || "",
        target: body.target || targetForKey(body.key),
        voice: body.voice,
      },
      appSession.user.id,
    );

    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Prompt config could not be saved.",
        error: "Prompt config could not be saved.",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json()) as ActivateBody;

  if (!body.id) {
    return NextResponse.json({ error: "Prompt config id is required." }, { status: 400 });
  }

  const config = await activatePromptConfig(body.id, appSession.user.id);

  if (!config) {
    return NextResponse.json({ error: "Prompt config was not found." }, { status: 404 });
  }

  return NextResponse.json({ config });
}
