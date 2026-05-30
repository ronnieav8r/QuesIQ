import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import { verifyStudyDeckWithAi } from "@/server/study/study-verification";

type Params = {
  params: Promise<{ deckId: string }>;
};

export async function POST(_request: Request, { params }: Params) {
  const session = await requireAdminSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { deckId } = await params;

  try {
    const result = await verifyStudyDeckWithAi({
      deckId,
      userId: session.user.id,
    });

    if (!result) {
      return NextResponse.json({ error: "Deck not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Study deck verification failed.",
      },
      { status: 502 },
    );
  }
}
