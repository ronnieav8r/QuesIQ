import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { selectNextNclexItem } from "@/server/nclex/nclex-data";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const nextItem = await selectNextNclexItem({
      sessionId: id,
      userId: session.user.id,
    });

    if (!nextItem) {
      return NextResponse.json({ error: "NCLEX session was not found." }, { status: 404 });
    }

    return NextResponse.json(nextItem);
  } catch (error) {
    console.error("NCLEX next item failed.", error);

    return NextResponse.json(
      {
        error: "NCLEX could not select the next item.",
      },
      { status: 503 },
    );
  }
}
