import { NextResponse } from "next/server";

import {
  type ContentStudioPipelineKey,
  findContentStudioPipeline,
  findContentStudioTemplate,
} from "@/features/admin/content-studio-config";
import { requireAdminSession } from "@/server/admin";
import { listContentStudioRunHistory } from "@/server/admin-content-studio/content-studio-runs";
import { generateStudyFlashcardDeckDraft } from "@/server/study/study-content-studio";

export const runtime = "nodejs";

type GenerateDraftBody = {
  customInstructions?: string;
  pipelineKey?: string;
  sourceText?: string;
  templateKey?: string;
};

const MIN_SOURCE_CHARS = 40;

function trimOptional(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function buildPromptInstructions(args: {
  customInstructions?: string;
  pipelineKey: ContentStudioPipelineKey;
  templateKey: string;
}) {
  const template = findContentStudioTemplate(args.pipelineKey, args.templateKey);
  const lines = [
    `Content Studio template: ${template?.label ?? args.templateKey}`,
    template?.description ? `Template intent: ${template.description}` : undefined,
    args.customInstructions ? `Admin instructions:\n${args.customInstructions}` : undefined,
  ].filter(Boolean);

  return lines.join("\n\n");
}

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    return NextResponse.json({
      runs: await listContentStudioRunHistory(),
      storage: {
        detail:
          "ai_runs stores AI-call audit history only. Full draft payloads and reviewer decisions need dedicated Content Studio run storage.",
        durableReviewState: false,
      },
    });
  } catch (error) {
    console.error("Content Studio run history load failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load Content Studio run history.",
        error: "Content Studio runs could not be loaded.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const appSession = await requireAdminSession();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as GenerateDraftBody;
  const pipelineKey = body.pipelineKey;
  const pipeline = pipelineKey ? findContentStudioPipeline(pipelineKey) : undefined;

  if (!pipeline) {
    return NextResponse.json({ error: "A valid Content Studio pipeline is required." }, { status: 400 });
  }

  if (pipeline.key === "dpe_content") {
    return NextResponse.json(
      {
        error:
          "DPE draft generation is not wired yet. The DPE product draft primitive is still pending.",
      },
      { status: 501 },
    );
  }

  const sourceText = trimOptional(body.sourceText);
  const templateKey = trimOptional(body.templateKey);

  if (!sourceText || sourceText.length < MIN_SOURCE_CHARS) {
    return NextResponse.json(
      { error: `Source text must be at least ${MIN_SOURCE_CHARS} characters.` },
      { status: 400 },
    );
  }

  if (!templateKey || !findContentStudioTemplate(pipeline.key, templateKey)) {
    return NextResponse.json({ error: "A valid reusable template is required." }, { status: 400 });
  }

  try {
    const customInstructions = trimOptional(body.customInstructions);
    const draft = await generateStudyFlashcardDeckDraft({
      promptInstructions: buildPromptInstructions({
        customInstructions,
        pipelineKey: pipeline.key,
        templateKey,
      }),
      sourceText,
      userId: appSession.user.id,
    });

    return NextResponse.json({
      run: {
        completedAt: new Date().toISOString(),
        draft,
        id: crypto.randomUUID(),
        pipelineKey: pipeline.key,
        stage: "review",
        status: "draft_ready",
        storage: "transient_review_state",
        templateKey,
      },
      runs: await listContentStudioRunHistory(),
      storage: {
        detail:
          "Draft review is held in the current Admin session. Durable draft payloads and reviewer decisions need dedicated Content Studio run storage.",
        durableReviewState: false,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Content Studio draft generation failed.",
      },
      { status: 502 },
    );
  }
}
