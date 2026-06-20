import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { buildEmptyQuestionResponse } from "@/features/dpe/questions";
import { fallbackQuestionResponse, listDpeQuestions } from "@/server/dpe/dpe-data";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(buildEmptyQuestionResponse(), { status: 401 });
  }

  try {
    const acsArea = request.nextUrl.searchParams.get("acsArea") ?? undefined;
    const acsTask = request.nextUrl.searchParams.get("acsTask") ?? undefined;
    const certificateTypeId = request.nextUrl.searchParams.get("certificateTypeId") ?? undefined;
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "5000");

    return NextResponse.json(
      await listDpeQuestions({
        acsArea,
        acsTask,
        certificateTypeId,
        limit: Number.isFinite(limit) ? limit : 100,
      }),
    );
  } catch (error) {
    console.error("DPE question API unavailable", error);
    return NextResponse.json(fallbackQuestionResponse(), { status: 200 });
  }
}
