import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { requireAdminSession } from "@/server/admin";
import {
  listDpeScenarioCases,
  parseDpeScenarioCase,
  upsertDpeScenarioCase,
} from "@/server/dpe/content-v2";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ available: false, scenarios: [] }, { status: 401 });
  }

  try {
    return NextResponse.json(
      await listDpeScenarioCases({
        certificateTypeId: request.nextUrl.searchParams.get("certificateTypeId") ?? undefined,
      }),
    );
  } catch (error) {
    console.error("DPE scenario cases unavailable", error);
    return NextResponse.json({ available: false, scenarios: [] }, { status: 200 });
  }
}

export async function POST(request: Request) {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const parsed = parseDpeScenarioCase(await request.json().catch(() => ({})));

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    return NextResponse.json(await upsertDpeScenarioCase(parsed.value));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DPE scenario case could not be saved." },
      { status: 400 },
    );
  }
}
