import { NextResponse } from "next/server";

import { rotateMobileRefreshToken } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { refreshToken?: unknown };

  if (typeof body.refreshToken !== "string" || !body.refreshToken) {
    return mobileApiError("invalid_refresh_token", "Refresh token is required.", 400);
  }

  try {
    return NextResponse.json(await rotateMobileRefreshToken(body.refreshToken));
  } catch {
    return mobileApiError("invalid_refresh_token", "Session expired. Sign in again.", 401);
  }
}
