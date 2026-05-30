import { NextResponse } from "next/server";

import {
  generateDpeContentStudioDraft,
  parseDpeContentDraftInput,
} from "@/server/dpe/content-draft";
import { requireAdminSession } from "@/server/admin";

export async function POST(request: Request) {
  const session = await requireAdminSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const parsed = parseDpeContentDraftInput(await request.json().catch(() => ({})));

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
