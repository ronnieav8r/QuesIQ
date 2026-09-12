import { InterviewLimitError } from "@/server/interview/beta-safety";
import { NextResponse } from "next/server";
import { preparationSelectionsSchema } from "@quesiq/interview-contracts";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";
import { PreparationError, resolvePreparationContext } from "@/server/profiles/preparation";
import { resolveStoryPreparation } from "@/server/interview/story-lab";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const user = await resolveRequestUser(request); if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  try {
    const q = new URL(request.url).searchParams;
    const selection = preparationSelectionsSchema.parse({ storyId: q.get("storyId") || undefined, introductionId: q.get("introductionId") || undefined, useSavedStories: q.get("useSavedStories") !== "false" });
    const snapshot = await resolveStoryPreparation(user.id, await resolvePreparationContext(user.id, { preparationSelections: selection, interviewContext: { jobTargetId: q.get("targetId") || undefined, preferredName: "", targetRole: "", targetCompany: "", jobDescription: "" }, modeKey: selection.introductionId ? "first_impression" : "coaching", styleKey: "friendly" }));
    return NextResponse.json({ materials: snapshot.reviewedMaterialVersions ?? [] });
  } catch (error) {
    if (error instanceof InterviewLimitError) return NextResponse.json({ error: { code: error.code, message: error.message, retryable: false, requestId: crypto.randomUUID(), limit: error.outcome } }, { status: error.status }); return error instanceof PreparationError ? mobileApiError(error.code, error.message, error.status) : mobileApiError("invalid_selection", "Preparation could not be loaded.", 400); }
}
