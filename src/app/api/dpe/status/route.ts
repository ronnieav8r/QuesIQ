import { NextResponse } from "next/server";

import { dpeTargetTracks } from "@/features/dpe/target-tracks";
import { listDpeContentSummary } from "@/server/dpe/dpe-data";

export const runtime = "nodejs";

export async function GET() {
  try {
    const summary = await listDpeContentSummary();
    const questionCount = summary.certificateTypes.reduce(
      (total, certificateType) => total + certificateType.questions.length,
      0,
    );

    return NextResponse.json({
      contentTablesReachable: summary.available,
      questionCount,
      status: summary.available ? "ok" : "degraded",
      targetTracks: dpeTargetTracks.map((track) => ({
        aircraftCategory: track.aircraftCategory,
        aircraftClass: track.aircraftClass,
        code: track.code,
        contentReady: track.contentReady,
        title: track.title,
      })),
    });
  } catch {
    return NextResponse.json({
      contentTablesReachable: false,
      questionCount: 0,
      status: "degraded",
      targetTracks: dpeTargetTracks.map((track) => ({
        aircraftCategory: track.aircraftCategory,
        aircraftClass: track.aircraftClass,
        code: track.code,
        contentReady: track.contentReady,
        title: track.title,
      })),
    });
  }
}
