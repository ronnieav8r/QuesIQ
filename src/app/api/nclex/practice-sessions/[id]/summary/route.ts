import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getNclexSessionSummary } from "@/server/nclex/nclex-data";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const summary = await getNclexSessionSummary({
      sessionId: id,
      userId: session.user.id,
    });

    if (!summary) {
      return NextResponse.json({ error: "NCLEX session was not found." }, { status: 404 });
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("NCLEX session summary failed.", error);

    return NextResponse.json(
      {
        error: "NCLEX summary could not be loaded.",
      },
      { status: 503 },
    );
  }
}
