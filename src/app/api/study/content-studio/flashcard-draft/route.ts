import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import {
  generateStudyFlashcardDeckDraft,
  getStudyContentStudioReviewSections,
} from "@/server/study/study-content-studio";
import {
  getStudySourcePackDraftReviewSections,
  parseStudySourcePackGeneratedDeckDraftContract,
  STUDY_SOURCE_PACK_DRAFT_SAMPLE,
} from "@/server/study/study-source-pack-draft-contract";
import {
  getStudyGenerationPacketReviewSections,
  parseStudyGenerationPacketContract,
  STUDY_GENERATION_PACKET_SAMPLE,
} from "@/server/study/study-generation-packet-contract";

export async function POST(request: Request) {
  const session = await requireAdminSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    generationPacketJson?: unknown;
    mode?: string;
    promptInstructions?: string;
    sourcePackDraftJson?: unknown;
    sourceText?: string;
  };
  if (body.mode === "source_pack_generation_packet_preview") {
    const candidatePayload = body.generationPacketJson ?? STUDY_GENERATION_PACKET_SAMPLE;
    const parsed = parseStudyGenerationPacketContract(candidatePayload);

    if (!parsed.ok) {
      return NextResponse.json(
        {
          error: "Invalid Study generation packet payload.",
          validationErrors: parsed.errors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      generationPacket: parsed.packet,
      generationPacketPreviewOnly: true,
      reviewSections: getStudyGenerationPacketReviewSections(parsed.packet),
    });
  }

  if (body.mode === "source_pack_preview") {
    const candidatePayload = body.sourcePackDraftJson ?? STUDY_SOURCE_PACK_DRAFT_SAMPLE;
    const parsed = parseStudySourcePackGeneratedDeckDraftContract(candidatePayload);

    if (!parsed.ok) {
      return NextResponse.json(
        {
          error: "Invalid source-pack Study draft contract payload.",
          validationErrors: parsed.errors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      draftContract: parsed.draft,
      reviewSections: getStudySourcePackDraftReviewSections(parsed.draft),
      sourcePackPreviewOnly: true,
    });
  }

  const sourceText = body.sourceText?.trim();

  if (!sourceText) {
    return NextResponse.json({ error: "Source text is required." }, { status: 400 });
  }
  if (sourceText.length < 40) {
    return NextResponse.json({ error: "Source text must be at least 40 characters." }, { status: 400 });
  }

  try {
    const draft = await generateStudyFlashcardDeckDraft({
      promptInstructions: body.promptInstructions,
      sourceText,
      userId: session.user.id,
    });

    return NextResponse.json({
      draft,
      reviewSections: getStudyContentStudioReviewSections(draft),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Study flashcard draft generation failed.",
      },
      { status: 502 },
    );
  }
}
