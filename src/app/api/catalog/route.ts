import { NextResponse } from "next/server";

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
    const catalog = await listInterviewCatalog();

    return NextResponse.json({ catalog });
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
