import { NextResponse } from "next/server";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";
import { PreparationError } from "@/server/profiles/preparation";
import { readProgress } from "@/server/interview/useful-progress";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const user = await resolveRequestUser(request); if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  try { return NextResponse.json(await readProgress(user.id, Object.fromEntries(new URL(request.url).searchParams))); }
  catch (error) { return error instanceof PreparationError ? mobileApiError(error.code, error.message, error.status) : mobileApiError("progress_unavailable", "Progress could not be loaded. Your saved work is unchanged.", 503, true); }
}
