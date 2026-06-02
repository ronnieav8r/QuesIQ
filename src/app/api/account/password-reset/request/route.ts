import { NextResponse } from "next/server";

import { requestPasswordReset } from "@/server/auth/password-auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => undefined)) as { email?: unknown } | undefined;

  await requestPasswordReset({
    email: body?.email,
    origin: new URL(request.url).origin,
  });

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link has been sent.",
  });
}
