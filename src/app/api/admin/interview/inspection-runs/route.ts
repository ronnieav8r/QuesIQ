import { NextRequest, NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import { listInterviewInspectionRuns } from "@/server/interview/inspection-ledger";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 50;

  try {
    const runs = await listInterviewInspectionRuns(limit);
    return NextResponse.json({ runs });
  } catch (error) {
    console.error("Interview inspection ledger failed.", error);
    return NextResponse.json(
      {
        detail: "The local database could not load Interview inspection records.",
        error: "Interview inspection records could not be loaded.",
      },
      { status: 503 },
    );
  }
}
