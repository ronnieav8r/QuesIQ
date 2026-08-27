import { NextResponse } from "next/server";

import { listJobTargets, parseJobTargetInput, saveJobTarget } from "@/server/job-targets/job-targets";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  return NextResponse.json({ targets: await listJobTargets(user.id) });
}

export async function POST(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  const body = await request.json().catch(() => ({})) as { target?: unknown };
  const target = parseJobTargetInput(body.target);
  if (!target?.targetRole) return mobileApiError("invalid_target", "Target role is required.", 400);
  return NextResponse.json({ target: await saveJobTarget(user.id, target) }, { status: 201 });
}
