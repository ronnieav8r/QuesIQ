import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { listDpeConceptFilters } from "@/server/dpe/concept-content";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        areas: [],
        available: false,
        modes: [],
        tags: [],
        tasksByArea: {},
      },
      { status: 401 },
    );
  }

  try {
    return NextResponse.json(
      await listDpeConceptFilters({
        certificateTypeId: request.nextUrl.searchParams.get("certificateTypeId") ?? undefined,
      }),
    );
  } catch (error) {
    console.error("DPE concept filters unavailable", error);
    return NextResponse.json(
      {
        areas: [],
        available: false,
        modes: [],
        tags: [],
        tasksByArea: {},
      },
      { status: 200 },
    );
  }
}
