import { NextResponse } from "next/server";

import { parseDpeConceptPacket, upsertDpeConceptPacket } from "@/server/dpe/concept-content";
import { requireAdminSession } from "@/server/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const parsed = parseDpeConceptPacket(await request.json().catch(() => ({})));

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await upsertDpeConceptPacket(parsed.value);

    return NextResponse.json({
      concept: result.concept,
      sources: result.sources,
      tags: result.tags,
      variants: result.variants.map((variant) => ({
        id: variant.id,
        mode: variant.mode,
        prompt: variant.prompt,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "DPE concept could not be saved.",
      },
      { status: 400 },
    );
  }
}
