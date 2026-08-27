import { NextResponse } from "next/server";

import { verifyPasswordCredentials } from "@/server/auth/password-auth";
import { issueMobileTokenPair } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { email?: unknown; password?: unknown };
  const user = await verifyPasswordCredentials(body);

  if (!user?.id) {
    return mobileApiError("invalid_credentials", "Email or password is incorrect.", 401);
  }

  return NextResponse.json(await issueMobileTokenPair({
    email: user.email ?? undefined,
    id: user.id,
    name: user.name ?? undefined,
  }));
}
