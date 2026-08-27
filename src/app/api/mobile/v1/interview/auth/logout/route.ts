import { NextResponse } from "next/server";

import { revokeMobileRefreshToken } from "@/server/mobile-auth/mobile-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { refreshToken?: unknown };

  if (typeof body.refreshToken === "string" && body.refreshToken) {
    await revokeMobileRefreshToken(body.refreshToken);
  }

  return NextResponse.json({ ok: true });
}
