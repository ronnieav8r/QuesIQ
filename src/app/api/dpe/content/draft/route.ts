import { NextResponse } from "next/server";

import {
  generateDpeContentStudioDraft,
  parseDpeContentDraftInput,
} from "@/server/dpe/content-draft";
import { parseDpeReferencePacketPreview } from "@/server/dpe/draft-reference";
import { requireAdminSession } from "@/server/admin";

export async function POST(request: Request) {
  const session = await requireAdminSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const bodyRecord = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};

  if (bodyRecord.mode === "source_pack_reference_packet_preview") {
    const parsedPreview = parseDpeReferencePacketPreview(
      bodyRecord.referencePacket ?? bodyRecord.packet ?? bodyRecord,
    );

    if (!parsedPreview.ok) {
      return NextResponse.json({ error: parsedPreview.error }, { status: parsedPreview.status ?? 400 });
    }

    return NextResponse.json({
      mode: "source_pack_reference_packet_preview",
      ...parsedPreview.preview,
    });
  }

  const parsed = parseDpeContentDraftInput(body);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const draft = await generateDpeContentStudioDraft({
      ...parsed.value,
      userId: session.user.id,
    });

    return NextResponse.json({ draft });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "DPE content draft generation failed.",
      },
      { status: 502 },
    );
  }
}
