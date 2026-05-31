import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import {
  createContentStudioRun,
  listContentStudioRuns,
} from "@/server/admin-content-studio/content-studio-runs";
import {
  buildSourcePackReviewExportDraft,
  parseSourcePackReviewExportPayload,
} from "@/server/admin-content-studio/source-pack-review-export";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const appSession = await requireAdminSession();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    reviewExport?: unknown;
  };
  const parsed = parseSourcePackReviewExportPayload(body.reviewExport ?? body);

  if (!parsed.ok) {
    return NextResponse.json(
      {
        error: "Invalid source-pack review export payload.",
        validationErrors: parsed.errors,
      },
      { status: 400 },
    );
  }

  try {
    const draft = buildSourcePackReviewExportDraft(parsed.exportPayload);
    const run = await createContentStudioRun({
      adminUserId: appSession.user.id,
      completedAt: new Date(),
      customInstructions:
        "Source-pack review export saved as durable Admin artifact. No AI generation was run.",
      draft,
      pipelineKey: "study_flashcards",
      sourceMetadata: {
        artifactType: "source_pack_review_export",
        manifestId: parsed.exportPayload.manifest.id,
        manifestTitle: parsed.exportPayload.manifest.title,
        reviewRunId: parsed.exportPayload.reviewRunId,
        stage: parsed.exportPayload.stage,
      },
      sourceText: JSON.stringify(parsed.exportPayload, null, 2),
      stage: "source_pack_admin_review_export_preview",
      status: "draft_ready",
      templateKey: "source_pack_review_export",
    });

    return NextResponse.json({
      run,
      runs: await listContentStudioRuns(),
      storage: {
        detail:
          "Source-pack review export saved durably as an Admin review artifact. Product imports and publish controls remain disabled.",
        durableReviewState: true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Source-pack review export could not be saved.",
      },
      { status: 502 },
    );
  }
}
