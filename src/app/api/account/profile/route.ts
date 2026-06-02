import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  getPlatformAccountProfile,
  parsePlatformAccountProfileInput,
  savePlatformAccountProfile,
} from "@/server/platform/account-profile";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const profile = await getPlatformAccountProfile(appSession.user.id);

  return NextResponse.json({
    email: appSession.user.email,
    name: appSession.user.name,
    profile: profile ?? {
      firstName: "",
      lastName: "",
      preferredName: "",
      userId: appSession.user.id,
    },
  });
}

export async function PUT(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const input = parsePlatformAccountProfileInput(await request.json());

  if (!input) {
    return NextResponse.json({ error: "Profile details are required." }, { status: 400 });
  }

  const profile = await savePlatformAccountProfile(appSession.user.id, input);

  return NextResponse.json({ profile });
}
