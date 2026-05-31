import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { createDpePracticeSession, listDpePracticeSessions } from "@/server/dpe/dpe-data";

type CreateSessionBody = {
  acsArea?: string;
  acsTask?: string;
  acsTitle?: string;
  certificateType?: {
    code?: string;
    id?: string;
    title?: string;
  } | null;
  mode?: string;
  questions?: unknown[];
  startedAt?: string;
  targetTrack?: unknown;
};

function dbUnavailable(error: unknown) {
  console.error("DPE practice session database unavailable", error);
  return NextResponse.json(
    {
      available: false,
      error: "Database is not available yet.",
      sessions: [],
    },
    { status: 200 },
  );
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ available: true, sessions: [] }, { status: 401 });
  }

  try {
    return NextResponse.json({
      available: true,
      sessions: await listDpePracticeSessions(session.user.id),
    });
  } catch (error) {
    return dbUnavailable(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ available: false, error: "Sign-in required." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as CreateSessionBody;

    if (!body.mode || !body.acsTitle || !body.acsArea || !body.acsTask) {
      return NextResponse.json({ error: "Missing session fields." }, { status: 400 });
    }

    const practiceSession = await createDpePracticeSession({
      acsArea: body.acsArea,
      acsTask: body.acsTask,
      acsTitle: body.acsTitle,
      certificateType:
        body.certificateType?.id && body.certificateType?.code && body.certificateType?.title
          ? {
              code: body.certificateType.code,
              id: body.certificateType.id,
              title: body.certificateType.title,
            }
          : null,
      mode: body.mode,
      questions: Array.isArray(body.questions) ? body.questions : [],
      startedAt: body.startedAt,
      targetTrack: body.targetTrack,
      userId: session.user.id,
    });

    return NextResponse.json({ available: true, session: practiceSession });
  } catch (error) {
    return dbUnavailable(error);
  }
}
