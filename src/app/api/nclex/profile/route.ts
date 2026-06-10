import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getOrCreateNclexProfile } from "@/server/nclex/nclex-data";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }

  try {
    return NextResponse.json({ profile: await getOrCreateNclexProfile(session.user.id) });
  } catch (error) {
    console.error("NCLEX profile unavailable.", error);

    return NextResponse.json(
      {
        available: false,
        error: "NCLEX profile is not available yet.",
      },
      { status: 200 },
    );
  }
}
