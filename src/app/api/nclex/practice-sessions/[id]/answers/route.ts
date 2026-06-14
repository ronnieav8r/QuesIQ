import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { submitNclexAnswer } from "@/server/nclex/nclex-data";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as {
    answer?: Record<string, unknown>;
    itemId?: string;
    timeSpentSeconds?: number;
  };

  if (!body.itemId || !body.answer || typeof body.answer !== "object") {
    return NextResponse.json({ error: "NCLEX answer payload is invalid." }, { status: 400 });
  }

  try {
    const result = await submitNclexAnswer({
      answer: body.answer,
      itemId: body.itemId,
      sessionId: id,
      timeSpentSeconds: body.timeSpentSeconds,
      userId: session.user.id,
    });

    if (!result) {
      return NextResponse.json({ error: "NCLEX session item was not found." }, { status: 404 });
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error("NCLEX answer submit failed.", error);

    return NextResponse.json(
      {
        error: "NCLEX answer could not be scored.",
      },
      { status: 503 },
    );
  }
}
