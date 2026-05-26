import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getProgressionSummary } from "@/server/progression/progression";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Progression needs a configured database.",
        error: "Progression could not be loaded.",
      },
      { status: 503 },
    );
  }

  try {
    const progression = await getProgressionSummary(appSession.user.id);

    return NextResponse.json({ progression });
  } catch (error) {
    console.error("Progression load failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load progression.",
        error: "Progression could not be loaded.",
      },
      { status: 503 },
    );
  }
}
