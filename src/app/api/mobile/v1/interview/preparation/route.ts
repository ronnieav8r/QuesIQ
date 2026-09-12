import { InterviewLimitError } from "@/server/interview/beta-safety";
import { NextResponse } from "next/server";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";
import { mutatePreparation, PreparationError, readPreparation } from "@/server/profiles/preparation";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  try { return NextResponse.json(await readPreparation(user.id)); }
  catch { return mobileApiError("preparation_unavailable", "Preparation could not load.", 503, true); }
}
export async function PUT(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  try { return NextResponse.json(await mutatePreparation(user.id, await request.json().catch(() => null))); }
  catch (error) {
    if (error instanceof InterviewLimitError) return NextResponse.json({ error: { code: error.code, message: error.message, retryable: false, requestId: crypto.randomUUID(), limit: error.outcome } }, { status: error.status }); return error instanceof PreparationError ? mobileApiError(error.code, error.message, error.status) : mobileApiError("preparation_unavailable", "Preparation could not be saved. Your draft is unchanged.", 503, true); }
}
