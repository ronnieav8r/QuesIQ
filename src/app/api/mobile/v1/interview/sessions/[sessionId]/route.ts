import { NextResponse } from "next/server";

import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";
import { listOwnedSessions } from "@/server/sessions/list-owned-sessions";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  const { sessionId } = await context.params;
  const session = (await listOwnedSessions(user.id, 100)).find((item) => item.id === sessionId);
  return session
    ? NextResponse.json({ session })
    : mobileApiError("not_found", "Session was not found.", 404);
}
