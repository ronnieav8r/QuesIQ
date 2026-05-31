import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDpeProfile, saveDpeProfile } from "@/server/dpe/dpe-data";

type DpeProfileBody = {
  aircraft?: string;
  aircraftCategory?: string;
  aircraftClass?: string;
  certificate?: string;
  checkrideDate?: string | null;
  flightSchool?: string;
  instructor?: string;
  knownDpeName?: string;
  personalNotes?: string;
  preferredName?: string;
  schoolContext?: string;
  targetTrackId?: string;
  weakAreaNotes?: string;
};

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({
      available: true,
      ...(await getDpeProfile(session.user.id)),
    });
  } catch (error) {
    console.error("DPE profile unavailable", error);
    return NextResponse.json(
      {
        available: false,
        error: "DPE profile storage is not available yet.",
        profile: null,
        target: null,
      },
      { status: 200 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as DpeProfileBody;

    return NextResponse.json({
      available: true,
      ...(await saveDpeProfile({
        aircraft: body.aircraft,
        aircraftCategory: body.aircraftCategory,
        aircraftClass: body.aircraftClass,
        certificate: body.certificate,
        checkrideDate: body.checkrideDate,
        flightSchool: body.flightSchool,
        instructor: body.instructor,
        knownDpeName: body.knownDpeName,
        personalNotes: body.personalNotes,
        preferredName: body.preferredName,
        schoolContext: body.schoolContext,
        targetTrackId: body.targetTrackId,
        userId: session.user.id,
        weakAreaNotes: body.weakAreaNotes,
      })),
    });
  } catch (error) {
    console.error("DPE profile save failed", error);
    return NextResponse.json(
      {
        available: false,
        error: "DPE profile storage is not available yet.",
        profile: null,
        target: null,
      },
      { status: 200 },
    );
  }
}
