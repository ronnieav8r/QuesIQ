import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import {
  getContentStudioRun,
  parseContentStudioRunStatus,
  updateContentStudioRunReview,
} from "@/server/admin-content-studio/content-studio-runs";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    runId: string;
  }>;
};

type UpdateRunBody = {
  reviewerNotes?: unknown;
  status?: unknown;
};

export async function GET(_request: Request, context: RouteContext) {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const { runId } = await context.params;
  const run = await getContentStudioRun(decodeURIComponent(runId));

  if (!run) {
    return NextResponse.json({ error: "Content Studio run was not found." }, { status: 404 });
  }

  return NextResponse.json({ run });
}

export async function PATCH(request: Request, context: RouteContext) {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const { runId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as UpdateRunBody;
  const status = parseContentStudioRunStatus(body.status);
  const reviewerNotes =
    typeof body.reviewerNotes === "string" ? body.reviewerNotes.trim().slice(0, 10_000) : undefined;

  if (!status && reviewerNotes === undefined) {
    return NextResponse.json(
      { error: "A review status or reviewer notes value is required." },
      { status: 400 },
    );
  }

  const run = await updateContentStudioRunReview(decodeURIComponent(runId), {
    reviewerNotes,
    status,
  });

  if (!run) {
    return NextResponse.json({ error: "Content Studio run was not found." }, { status: 404 });
  }

  return NextResponse.json({ run });
}
