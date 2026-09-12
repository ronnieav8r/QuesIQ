import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";
import { PreparationError } from "@/server/profiles/preparation";
import { readRecommendations, dismissRecommendation } from "@/server/interview/useful-progress";
export const runtime = "nodejs";
async function handle(request: Request) {
  const user = await resolveRequestUser(request); if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  try {
    const raw = new URL(request.url).searchParams.get("target");
    if (raw && raw !== "general" && !z.string().uuid().safeParse(raw).success) throw new PreparationError("invalid_target", "Choose a valid target.", 400);
    return NextResponse.json(request.method === "GET" ? await readRecommendations(user.id, raw === "general" ? null : raw ?? undefined) : await dismissRecommendation(user.id, await request.json()));
  } catch (error) { return error instanceof PreparationError ? mobileApiError(error.code, error.message, error.status) : mobileApiError("recommendations_unavailable", "Suggestions could not be loaded. Choose your own practice or retry.", 503, true); }
}
export const GET = handle; export const POST = handle;
