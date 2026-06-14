import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import { listNclexQuestions } from "@/server/nclex/nclex-data";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    return NextResponse.json({
      questions: await listNclexQuestions(),
    });
  } catch (error) {
    console.error("NCLEX admin questions unavailable.", error);

    return NextResponse.json(
      {
        error: "NCLEX admin question library could not be loaded.",
      },
      { status: 503 },
    );
  }
}
