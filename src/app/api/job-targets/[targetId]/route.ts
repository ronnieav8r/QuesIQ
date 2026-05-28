import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  deleteJobTarget,
  parseJobTargetInput,
  setActiveJobTarget,
  updateJobTarget,
} from "@/server/job-targets/job-targets";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    targetId: string;
  }>;
};

function databaseUnavailable(error: string) {
  return NextResponse.json(
    {
      detail: "Job targets need a configured database.",
      error,
    },
    { status: 503 },
  );
}

export async function PUT(request: Request, context: RouteContext) {
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
    return databaseUnavailable("Job target could not be updated.");
  }

  try {
    const { targetId } = await context.params;
    const target = await updateJobTarget(appSession.user.id, targetId, targetInput);

    if (!target) {
      return NextResponse.json({ error: "Job target was not found." }, { status: 404 });
    }

    return NextResponse.json({ target });
  } catch (error) {
    console.error("Job target update failed.", error);

    return NextResponse.json(
      {
        detail:
          error instanceof Error ? error.message : "The database could not update this target.",
        error: "Job target could not be updated.",
      },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const body = (await request.json()) as { active?: unknown };

  if (body.active !== true) {
    return NextResponse.json({ error: "Patch action is invalid." }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return databaseUnavailable("Active job target could not be saved.");
  }

  try {
    const { targetId } = await context.params;
    const target = await setActiveJobTarget(appSession.user.id, targetId);

    if (!target) {
      return NextResponse.json({ error: "Job target was not found." }, { status: 404 });
    }

    return NextResponse.json({ target });
  } catch (error) {
    console.error("Active job target update failed.", error);

    return NextResponse.json(
      {
        detail:
          error instanceof Error
            ? error.message
            : "The database could not save the active target.",
        error: "Active job target could not be saved.",
      },
      { status: 503 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return databaseUnavailable("Job target could not be deleted.");
  }

  try {
    const { targetId } = await context.params;
    const deleted = await deleteJobTarget(appSession.user.id, targetId);

    if (!deleted) {
      return NextResponse.json({ error: "Job target was not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Job target delete failed.", error);

    return NextResponse.json(
      {
        detail:
          error instanceof Error ? error.message : "The database could not delete this target.",
        error: "Job target could not be deleted.",
      },
      { status: 503 },
    );
  }
}
