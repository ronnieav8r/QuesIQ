import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import {
  interviewInspectionRunsToCsv,
  listInterviewInspectionRuns,
} from "@/server/interview/inspection-ledger";

export const runtime = "nodejs";

export async function GET(request?: Request) {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const runs = await listInterviewInspectionRuns(100);
    const date = new Date().toISOString().slice(0, 10);
    if (request && new URL(request.url).searchParams.get("format") === "json") {
      return NextResponse.json({ runs }, { headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="quesiq-interview-inspection-${date}.json"`,
      } });
    }
    const csv = interviewInspectionRunsToCsv(runs);

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="quesiq-interview-inspection-${date}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Interview inspection CSV export failed.", error);
    return NextResponse.json(
      {
        detail: "The local database could not export Interview inspection records.",
        error: "Interview inspection export could not be created.",
      },
      { status: 503 },
    );
  }
}
