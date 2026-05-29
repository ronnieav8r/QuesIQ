import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDpeProfile, saveDpeProfile } from "@/server/dpe/dpe-data";

type DpeProfileBody = {
  aircraft?: string;
  checkrideDate?: string | null;
  flightSchool?: string;
  instructor?: string;
  knownDpeName?: string;
  personalNotes?: string;
  preferredName?: string;
  schoolContext?: string;
  weakAreaNotes?: string;
};

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await getDpeProfile(session.user.id));
}

export async function PUT(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as DpeProfileBody;

  return NextResponse.json(
    await saveDpeProfile({
      aircraft: body.aircraft,
      checkrideDate: body.checkrideDate,
      flightSchool: body.flightSchool,
      instructor: body.instructor,
      knownDpeName: body.knownDpeName,
      personalNotes: body.personalNotes,
      preferredName: body.preferredName,
      schoolContext: body.schoolContext,
      userId: session.user.id,
      weakAreaNotes: body.weakAreaNotes,
    }),
  );
}
