import { NextResponse } from "next/server";

import {
  type ContentStudioPipelineKey,
  findContentStudioPipeline,
  findContentStudioTemplate,
} from "@/features/admin/content-studio-config";
import {
  findDpeTargetTrack,
  parseDpeTargetTrackKey,
} from "@/features/admin/dpe-target-tracks";
import { requireAdminSession } from "@/server/admin";
import {
  createContentStudioRun,
  findLatestContentStudioAiRun,
  listContentStudioRuns,
} from "@/server/admin-content-studio/content-studio-runs";
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
    targetTrackKey?: string;
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
  const targetTrackKey = parseDpeTargetTrackKey(context?.targetTrackKey);
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
    targetTrackKey,
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
      runs: await listContentStudioRuns(),
      storage: {
        detail:
          "Content Studio runs are stored durably with source snapshots, draft payloads, reviewer notes, and review status. Publish remains disabled.",
        durableReviewState: true,
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
    const dpeDraftContext =
      pipeline.key === "dpe_content" ? trimDraftContext(body.dpeContext) : undefined;
    const promptInstructions = buildPromptInstructions({
      customInstructions,
      pipelineKey: pipeline.key,
      templateKey,
    });
    const generationStartedAt = new Date();
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
    const aiRun = await findLatestContentStudioAiRun({
      pipelineKey: pipeline.key,
      since: generationStartedAt,
      userId: appSession.user.id,
    });
    const run = await createContentStudioRun({
      adminUserId: appSession.user.id,
      aiRunId: aiRun?.id,
      completedAt: new Date(),
      customInstructions,
      draft: draft as Record<string, unknown>,
      pipelineKey: pipeline.key,
      sourceMetadata: {
        aiProviderRequestId: aiRun?.providerRequestId,
        dpeContext: dpeDraftContext,
        dpeTrackKey: dpeDraftContext?.targetTrackKey,
        dpeTrackLabel: findDpeTargetTrack(dpeDraftContext?.targetTrackKey)?.label,
      },
      sourceText,
      templateKey,
    });

    return NextResponse.json({
      run,
      runs: await listContentStudioRuns(),
      storage: {
        detail:
          "Draft review state has been saved durably. Publish remains disabled until product publish controls exist.",
        durableReviewState: true,
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
