import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  listJobTargets,
  parseJobTargetInput,
  saveJobTarget,
} from "@/server/job-targets/job-targets";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Job targets need a configured database.",
        error: "Job targets could not be loaded.",
      },
      { status: 503 },
    );
  }

  try {
    const targets = await listJobTargets(appSession.user.id);

    return NextResponse.json({ targets });
  } catch (error) {
    console.error("Job target list failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load job targets.",
        error: "Job targets could not be loaded.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const body = (await request.json()) as { target?: unknown };
  const targetInput = parseJobTargetInput(body.target);

  if (!targetInput?.targetRole) {
    return NextResponse.json({ error: "Target role is required." }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Job targets need a configured database.",
        error: "Job target could not be saved.",
      },
      { status: 503 },
    );
  }

  try {
    const target = await saveJobTarget(appSession.user.id, targetInput);

    return NextResponse.json({ target });
  } catch (error) {
    console.error("Job target save failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not save this job target.",
        error: "Job target could not be saved.",
      },
      { status: 503 },
    );
  }
}
