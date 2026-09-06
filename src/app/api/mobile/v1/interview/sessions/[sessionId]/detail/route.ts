import { NextResponse } from "next/server";

import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";
import { getOwnedSessionHistoryItem } from "@/server/sessions/list-owned-sessions";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  const { sessionId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return mobileApiError("not_found", "Session was not found.", 404);
  }
  const session = await getOwnedSessionHistoryItem(sessionId, user.id);
  return session
    ? NextResponse.json({ session })
    : mobileApiError("not_found", "Session was not found.", 404);
}
