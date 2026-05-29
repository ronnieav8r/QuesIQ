import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { getOwnedDpePracticeSession, updateDpePracticeSession } from "@/server/dpe/dpe-data";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateSessionBody = {
  answers?: unknown[];
  endedAt?: string;
  review?: unknown;
  status?: string;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ available: false, error: "Sign-in required." }, { status: 401 });
  }

  try {
    const existing = await getOwnedDpePracticeSession(id, session.user.id);

    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = (await request.json()) as UpdateSessionBody;
    const practiceSession = await updateDpePracticeSession({
      answers: body.answers,
      endedAt: body.endedAt,
      id,
      review: body.review,
      status: body.status ?? existing.status,
    });

    return NextResponse.json({ available: true, session: practiceSession });
  } catch (error) {
    console.error("DPE practice session update failed", error);
    return NextResponse.json(
      {
        available: false,
        error: "Database is not available yet.",
      },
      { status: 200 },
    );
  }
}
