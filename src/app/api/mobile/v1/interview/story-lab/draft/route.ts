import { InterviewLimitError } from "@/server/interview/beta-safety";
import { NextResponse } from "next/server";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";
import { PreparationError } from "@/server/profiles/preparation";
import { draftLabMaterial } from "@/server/interview/story-lab";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  try { return NextResponse.json(await draftLabMaterial(user.id, await request.json())); }
  catch (error) {
    if (error instanceof InterviewLimitError) return NextResponse.json({ error: { code: error.code, message: error.message, retryable: false, requestId: crypto.randomUUID(), limit: error.outcome } }, { status: error.status }); return error instanceof PreparationError ? mobileApiError(error.code, error.message, error.status) : mobileApiError("draft_unavailable", "Draft unavailable. Your saved material is unchanged.", 503); }
}
