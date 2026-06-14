import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getNclexStatus } from "@/server/nclex/nclex-data";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();

  try {
    return NextResponse.json(await getNclexStatus(session?.user?.id));
  } catch (error) {
    console.error("NCLEX status unavailable.", error);

    return NextResponse.json(
      {
        available: false,
        error: "NCLEX status is not available yet.",
      },
      { status: 200 },
    );
  }
}
