import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDpeProgressionSummary } from "@/server/dpe/dpe-progression";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ available: false, error: "Sign-in required." }, { status: 401 });
  }

  try {
    const progression = await getDpeProgressionSummary(session.user.id);
    return NextResponse.json({ available: true, progression });
  } catch (error) {
    console.error("DPE progression load failed", error);
    return NextResponse.json(
      {
        available: false,
        error: "DPE progression storage is not available yet.",
      },
      { status: 200 },
    );
  }
}
