import { NextResponse } from "next/server";

import {
  devAuthUsers,
  isDevAuthBypassEnabled,
} from "@/server/auth/dev-bypass";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { issueMobileTokenPair } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" || !isDevAuthBypassEnabled()) {
    return mobileApiError("not_found", "Local mobile sign-in is unavailable.", 404);
  }

  const body = await request.json().catch(() => ({})) as { role?: unknown };
  const role = body.role === "user" ? "user" : "admin";
  const user = devAuthUsers[role];

  try {
    await getDb()
      .insert(users)
      .values({
        email: user.email,
        emailVerified: new Date(),
        id: user.id,
        image: user.image,
        name: user.name,
      })
      .onConflictDoNothing();

    return NextResponse.json(await issueMobileTokenPair({
      email: user.email ?? undefined,
      id: user.id,
      name: user.name ?? undefined,
    }));
  } catch (error) {
    console.error("Mobile dev sign-in failed.", error);
    return mobileApiError("dev_sign_in_failed", "Local mobile sign-in failed.", 503, true);
  }
}
