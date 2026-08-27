import { NextResponse } from "next/server";

import { parseInterviewContext } from "@/product/interview-context";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";
import { getProfile } from "@/server/profiles/get-profile";
import { saveProfile } from "@/server/profiles/save-profile";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  return NextResponse.json({ profile: await getProfile(user.id) });
}

export async function PUT(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);

  const body = await request.json().catch(() => ({})) as { profile?: unknown };
  const profile = parseInterviewContext(body.profile);
  if (!profile) return mobileApiError("invalid_profile", "Profile information is invalid.", 400);

  return NextResponse.json({ profile: await saveProfile(user.id, profile) });
}
