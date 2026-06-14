import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  dpeConceptVariantModes,
  listDpeQuestionVariants,
  type DpeConceptVariantMode,
} from "@/server/dpe/concept-content";

export const runtime = "nodejs";

function modeFromParam(value: string | null): DpeConceptVariantMode | undefined {
  return dpeConceptVariantModes.includes(value as DpeConceptVariantMode)
    ? (value as DpeConceptVariantMode)
    : undefined;
}

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ available: false, variants: [] }, { status: 401 });
  }

  try {
    const tags = request.nextUrl.searchParams
      .getAll("tag")
      .flatMap((tag) => tag.split(","))
      .map((tag) => tag.trim())
      .filter(Boolean);

    return NextResponse.json(
      await listDpeQuestionVariants({
        acsArea: request.nextUrl.searchParams.get("acsArea") ?? undefined,
        acsTask: request.nextUrl.searchParams.get("acsTask") ?? undefined,
        certificateTypeId: request.nextUrl.searchParams.get("certificateTypeId") ?? undefined,
        mode: modeFromParam(request.nextUrl.searchParams.get("mode")),
        query: request.nextUrl.searchParams.get("query") ?? undefined,
        tags,
      }),
    );
  } catch (error) {
    console.error("DPE concept variants unavailable", error);
    return NextResponse.json({ available: false, variants: [] }, { status: 200 });
  }
}
