import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getCoachingMemory } from "@/server/coaching-memory/coaching-memory";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Coaching memory needs a configured database.",
        error: "Coaching memory could not be loaded.",
      },
      { status: 503 },
    );
  }

  try {
    const memory = await getCoachingMemory(appSession.user.id);

    return NextResponse.json({ memory });
  } catch (error) {
    console.error("Coaching memory load failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load coaching memory.",
        error: "Coaching memory could not be loaded.",
      },
      { status: 503 },
    );
  }
}
