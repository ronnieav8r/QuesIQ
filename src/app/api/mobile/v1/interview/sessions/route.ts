import { POST as createSession } from "@/app/api/sessions/route";
import { mobileApiError, normalizeMobileResponse } from "@/server/mobile-auth/responses";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { listMobileHistory, parseHistoryPageRequest } from "@/server/sessions/mobile-history";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  let page;
  try { page = parseHistoryPageRequest(request.url); }
  catch { return mobileApiError("invalid_history_page", "The History cursor or page size is invalid.", 400); }
  try { return NextResponse.json(await listMobileHistory(user.id, page)); }
  catch { return mobileApiError("history_unavailable", "History could not load. Please retry.", 503, true); }
}

export async function POST(request: Request) {
  return normalizeMobileResponse(await createSession(request));
}
