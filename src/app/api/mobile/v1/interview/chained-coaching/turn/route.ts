import { NextResponse } from "next/server";
import { coachingTurnInputSchema, mobileCoachingTurn } from "@/server/interview/chained-coaching-service";
import { CoachingOperationError } from "@/server/interview/coaching-operations";
import { CoachingExerciseError } from "@/server/interview/coaching-exercise";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  const text = await request.text();
  if (text.length > 100_000) return mobileApiError("invalid_payload", "Request is too large.", 413);
  let json: unknown;
  try { json = JSON.parse(text); } catch { return mobileApiError("invalid_payload", "Invalid JSON.", 400); }
  const parsed = coachingTurnInputSchema.safeParse(json);
  if (!parsed.success) return mobileApiError("invalid_payload", "A valid Coaching turn is required.", 400);
  try { return NextResponse.json(await mobileCoachingTurn(user.id, parsed.data)); }
  catch (error) {
    if (error instanceof CoachingExerciseError) return mobileApiError(error.code, error.message, 409, false);
    if (error instanceof CoachingOperationError) return mobileApiError(error.code, error.message, error.status, error.code === "turn_processing");
    return mobileApiError("chained_coaching_failed", "Que could not complete this step. Retry response; completed text will be reused.", 503, true);
  }
}
