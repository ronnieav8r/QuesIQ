import { NextResponse } from "next/server";

import {
  deleteJobTarget,
  parseJobTargetInput,
  setActiveJobTarget,
  updateJobTarget,
} from "@/server/job-targets/job-targets";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ targetId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  const body = await request.json().catch(() => ({})) as { target?: unknown };
  const targetInput = parseJobTargetInput(body.target);
  if (!targetInput?.targetRole) return mobileApiError("invalid_target", "Target role is required.", 400);
  const { targetId } = await context.params;
  const target = await updateJobTarget(user.id, targetId, targetInput);
  return target
    ? NextResponse.json({ target })
    : mobileApiError("not_found", "Job target was not found.", 404);
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  const body = await request.json().catch(() => ({})) as { active?: unknown };
  if (body.active !== true) return mobileApiError("invalid_action", "Active target action is invalid.", 400);
  const { targetId } = await context.params;
  const target = await setActiveJobTarget(user.id, targetId);
  return target
    ? NextResponse.json({ target })
    : mobileApiError("not_found", "Job target was not found.", 404);
}

export async function DELETE(request: Request, context: RouteContext) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  const { targetId } = await context.params;
  return (await deleteJobTarget(user.id, targetId))
    ? NextResponse.json({ ok: true })
    : mobileApiError("not_found", "Job target was not found.", 404);
}
