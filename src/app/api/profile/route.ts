import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { parseInterviewContext } from "@/product/interview-context";
import { getProfile } from "@/server/profiles/get-profile";
import { saveProfile } from "@/server/profiles/save-profile";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Profile context needs a configured database.",
        error: "Profile context could not be loaded.",
      },
      { status: 503 },
    );
  }

  try {
    const profile = await getProfile(appSession.user.id);

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Profile context load failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load profile context.",
        error: "Profile context could not be loaded.",
      },
      { status: 503 },
    );
  }
}

export async function PUT(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const body = (await request.json()) as { profile?: unknown };
  const profile = parseInterviewContext(body.profile);

  if (!profile) {
    return NextResponse.json({ error: "Profile context is invalid." }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Profile context needs a configured database.",
        error: "Profile context could not be saved.",
      },
      { status: 503 },
    );
  }

  try {
    const savedProfile = await saveProfile(appSession.user.id, profile);

    return NextResponse.json({ profile: savedProfile });
  } catch (error) {
    console.error("Profile context save failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not save profile context.",
        error: "Profile context could not be saved.",
      },
      { status: 503 },
    );
  }
}
