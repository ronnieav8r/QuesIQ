import { InterviewLimitError } from "@/server/interview/beta-safety";
import { NextResponse } from "next/server";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";
import { PreparationError } from "@/server/profiles/preparation";
import { readStoryLab, saveLabMaterial, deleteLabMaterial } from "@/server/interview/story-lab";
export const runtime = "nodejs";
async function handle(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  try { return NextResponse.json(request.method === "GET" ? await readStoryLab(user.id) : await (request.method === "PUT" ? saveLabMaterial : deleteLabMaterial)(user.id, await request.json())); }
  catch (error) {
    if (error instanceof InterviewLimitError) return NextResponse.json({ error: { code: error.code, message: error.message, retryable: false, requestId: crypto.randomUUID(), limit: error.outcome } }, { status: error.status }); return error instanceof PreparationError ? mobileApiError(error.code, error.message, error.status) : mobileApiError("material_unavailable", "Material could not be loaded or saved. Keep your draft and retry.", 503, true); }
}
export const GET = handle; export const PUT = handle; export const DELETE = handle;
