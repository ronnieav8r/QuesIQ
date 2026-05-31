import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import { listQuiraAdminSupportData } from "@/server/support/quira-support";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Quira support review needs a configured database." },
      { status: 503 },
    );
  }

  try {
    const support = await listQuiraAdminSupportData();

    return NextResponse.json({ support });
  } catch (error) {
    console.error("Quira admin support data failed.", error);

    return NextResponse.json(
      { error: "Quira support data could not be loaded." },
      { status: 503 },
    );
  }
}
