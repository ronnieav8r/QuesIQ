import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import { normalizeSourcePackReviewBundle } from "@/server/admin-content-studio/source-pack-review";

export const runtime = "nodejs";

const MAX_PREVIEW_BYTES = 500_000;

export async function POST(request: Request) {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const rawBody = await request.text();

  if (rawBody.length > MAX_PREVIEW_BYTES) {
    return NextResponse.json(
      {
        error: "Source-pack preview payload is too large for the admin preview scaffold.",
      },
      { status: 413 },
    );
  }

  let payload: unknown;

  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json(
      { error: "Source-pack preview payload must be valid JSON." },
      { status: 400 },
    );
  }

  const preview = normalizeSourcePackReviewBundle(payload);

  return NextResponse.json({
    ...preview,
    storage: {
      detail:
        "Source-pack preview is normalized in memory only. No files, Drive data, product imports, publish state, or review decisions are saved.",
      durableReviewState: false,
    },
  });
}
