import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import { listAdminDpeProgressionSnapshot } from "@/server/admin-data/dpe-progression";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const progression = await listAdminDpeProgressionSnapshot();

    return NextResponse.json({ progression });
  } catch (error) {
    console.error("DPE progression admin load failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load DPE progression.",
        error: "DPE progression could not be loaded.",
      },
      { status: 503 },
    );
  }
}
