import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import { listAdminData } from "@/server/admin-data/admin-data";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    return NextResponse.json(await listAdminData(100));
  } catch (error) {
    console.error("Admin data load failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load admin data.",
        error: "Admin data could not be loaded.",
      },
      { status: 503 },
    );
  }
}
