import { NextResponse } from "next/server";

import type { PromptComponentRecord } from "@/product/interview-types";
import { requireAdminSession } from "@/server/admin";
import {
  listPromptComponents,
  updatePromptComponent,
} from "@/server/catalog/prompt-components";

export const runtime = "nodejs";

type PatchBody = {
  key?: string;
  promptInstructions?: string;
  type?: PromptComponentRecord["type"];
};

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const components = await listPromptComponents();

    return NextResponse.json({ components });
  } catch (error) {
    console.error("Prompt component list failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load prompt components.",
        error: "Prompt components could not be loaded.",
      },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request) {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json()) as PatchBody;

  if (!body.key || !body.type || body.promptInstructions === undefined) {
    return NextResponse.json(
      { error: "Prompt component key, type, and instructions are required." },
      { status: 400 },
    );
  }

  const component = await updatePromptComponent({
    key: body.key,
    promptInstructions: body.promptInstructions,
    type: body.type,
  });

  if (!component) {
    return NextResponse.json({ error: "Prompt component was not found." }, { status: 404 });
  }

  return NextResponse.json({ component });
}
