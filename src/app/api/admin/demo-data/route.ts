import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import { seedRonnieDemoData } from "@/server/admin-data/seed-demo-data";

export const runtime = "nodejs";

export async function POST() {
  const appSession = await requireAdminSession();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Demo data needs a configured database.",
        error: "Demo data could not be created.",
      },
      { status: 503 },
    );
  }

  try {
    const result = await seedRonnieDemoData(appSession.user.id);

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Demo data seed failed.", error);

    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Demo data could not be created.",
        error: "Demo data could not be created.",
      },
      { status: 503 },
    );
  }
}
