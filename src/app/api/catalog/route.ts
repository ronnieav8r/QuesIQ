import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { handsFreeCoachingModeKey, canUseHandsFreeCoaching } from "@/server/interview/hands-free-coaching";
import { listInterviewCatalog } from "@/server/catalog/list-interview-catalog";

export const runtime = "nodejs";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Interview catalog needs a configured database.",
        error: "Interview catalog could not be loaded.",
      },
      { status: 503 },
    );
  }

  try {
    const appSession = await auth();
    const catalog = await listInterviewCatalog();
    const practiceModes = canUseHandsFreeCoaching(appSession?.user?.email)
      ? catalog.practiceModes
      : catalog.practiceModes.filter((mode) => mode.key !== handsFreeCoachingModeKey);

    return NextResponse.json({ catalog: { ...catalog, practiceModes } });
  } catch (error) {
    console.error("Interview catalog load failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load interview catalog records.",
        error: "Interview catalog could not be loaded.",
      },
      { status: 503 },
    );
  }
}
