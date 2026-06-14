import { NextResponse } from "next/server";

import { listNclexQuestions } from "@/server/nclex/nclex-data";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({
      available: true,
      questions: await listNclexQuestions(),
    });
  } catch (error) {
    console.error("NCLEX questions unavailable.", error);

    return NextResponse.json(
      {
        available: false,
        error: "NCLEX question bank is not available yet.",
        questions: [],
      },
      { status: 200 },
    );
  }
}
