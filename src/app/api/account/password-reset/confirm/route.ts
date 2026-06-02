import { NextResponse } from "next/server";

import { resetPasswordWithToken } from "@/server/auth/password-auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => undefined)) as
    | {
        confirmPassword?: unknown;
        email?: unknown;
        password?: unknown;
        token?: unknown;
      }
    | undefined;

  try {
    await resetPasswordWithToken({
      confirmPassword: body?.confirmPassword,
      email: body?.email,
      password: body?.password,
      token: body?.token,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Password could not be reset.",
      },
      { status: 400 },
    );
  }
}
