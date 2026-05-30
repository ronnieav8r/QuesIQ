import { NextResponse } from "next/server";

import {
  type ContentStudioPipelineKey,
  findContentStudioPipeline,
  findContentStudioTemplate,
} from "@/features/admin/content-studio-config";
import { requireAdminSession } from "@/server/admin";
import { listContentStudioRunHistory } from "@/server/admin-content-studio/content-studio-runs";
import { generateDpeContentStudioDraft } from "@/server/dpe/content-draft";
import { generateStudyFlashcardDeckDraft } from "@/server/study/study-content-studio";

export const runtime = "nodejs";

type GenerateDraftBody = {
  customInstructions?: string;
  dpeContext?: {
    acs?: {
      area?: string;
      elementType?: string;
      reference?: string;
      task?: string;
      title?: string;
    };
    certificate?: {
      code?: string;
      id?: string;
      title?: string;
    };
  };
  pipelineKey?: string;
  sourceText?: string;
  templateKey?: string;
};

const MIN_SOURCE_CHARS = 40;

function trimOptional(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function trimDraftContext(context: GenerateDraftBody["dpeContext"]) {
  return {
    acs: {
      area: trimOptional(context?.acs?.area),
      elementType: trimOptional(context?.acs?.elementType),
      reference: trimOptional(context?.acs?.reference),
      task: trimOptional(context?.acs?.task),
      title: trimOptional(context?.acs?.title),
    },
    certificate: {
      code: trimOptional(context?.certificate?.code),
      id: trimOptional(context?.certificate?.id),
      title: trimOptional(context?.certificate?.title),
    },
  };
}

function hasCertificateContext(certificate: ReturnType<typeof trimDraftContext>["certificate"]) {
  return Boolean(certificate.code || certificate.id || certificate.title);
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

  if (pipeline.key === "dpe_content") {
    const dpeContext = trimDraftContext(body.dpeContext);

    if (!hasCertificateContext(dpeContext.certificate)) {
      return NextResponse.json(
        { error: "Certificate context is required for DPE draft generation." },
        { status: 400 },
      );
    }
  }

  try {
    const customInstructions = trimOptional(body.customInstructions);
    const promptInstructions = buildPromptInstructions({
      customInstructions,
      pipelineKey: pipeline.key,
      templateKey,
    });
    const draft =
      pipeline.key === "dpe_content"
        ? await generateDpeDraft({
            body,
            promptInstructions,
            sourceText,
            userId: appSession.user.id,
          })
        : await generateStudyFlashcardDeckDraft({
            promptInstructions,
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

async function generateDpeDraft(args: {
  body: GenerateDraftBody;
  promptInstructions: string;
  sourceText: string;
  userId: string;
}) {
  const dpeContext = trimDraftContext(args.body.dpeContext);

  if (!hasCertificateContext(dpeContext.certificate)) {
    throw new Error("Certificate context is required for DPE draft generation.");
  }

  return generateDpeContentStudioDraft({
    acs: dpeContext.acs,
    certificate: dpeContext.certificate,
    promptInstructions: args.promptInstructions,
    sourceText: args.sourceText,
    userId: args.userId,
  });
}
