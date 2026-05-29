import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { listDpeContentSummary } from "@/server/dpe/dpe-data";
import { isAdminEmail } from "@/server/admin";

export async function GET() {
  const session = await auth();

  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json(
      {
        available: false,
        certificateTypes: [],
        error: "Admin access required.",
      },
      { status: 403 },
    );
  }

  try {
    return NextResponse.json(await listDpeContentSummary());
  } catch (error) {
    console.error("DPE content summary unavailable", error);
    return NextResponse.json(
      {
        available: false,
        certificateTypes: [],
      },
      { status: 200 },
    );
  }
}
