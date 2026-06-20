import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { requireAdminSession } from "@/server/admin";
import {
  listDpeMockOralBlueprints,
  parseDpeMockOralBlueprint,
  upsertDpeMockOralBlueprint,
} from "@/server/dpe/content-v2";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ available: false, blueprints: [] }, { status: 401 });
  }

  try {
    return NextResponse.json(
      await listDpeMockOralBlueprints({
        certificateTypeId: request.nextUrl.searchParams.get("certificateTypeId") ?? undefined,
      }),
    );
  } catch (error) {
    console.error("DPE mock oral blueprints unavailable", error);
    return NextResponse.json({ available: false, blueprints: [] }, { status: 200 });
  }
}

export async function POST(request: Request) {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const parsed = parseDpeMockOralBlueprint(await request.json().catch(() => ({})));

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const blueprint = await upsertDpeMockOralBlueprint(parsed.value);
    return NextResponse.json({ blueprint });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DPE mock oral blueprint could not be saved." },
      { status: 400 },
    );
  }
}
