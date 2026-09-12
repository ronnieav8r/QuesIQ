import { InterviewLimitError } from "@/server/interview/beta-safety";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";
import { PreparationError, readPreparation } from "@/server/profiles/preparation";
import { createPreparationDraft } from "@/server/profiles/preparation-drafts";
import { getOrCreateInterviewResumeSummary } from "@/server/profiles/resume-summary";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const user = await resolveRequestUser(request); if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  const parsed = z.object({ id: z.string().uuid(), revision: z.number().int().nonnegative() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return mobileApiError("invalid_request", "A valid draft request is required.", 400);
  try {
    const prep = await readPreparation(user.id);
    if (prep.revision !== parsed.data.revision || !prep.profile?.resumeConfirmedAt || !prep.profile.resumeText) throw new PreparationError("stale_resume", "Confirm the current resume text first.");
    const result = await createPreparationDraft({ userId: user.id, id: parsed.data.id, revision: prep.revision, kind: "resume_summary", source: prep.profile.resumeText,
      generate: async () => { const result = await getOrCreateInterviewResumeSummary({ ...prep.profile, userId: user.id, persist: false }); if (!result.summary) throw new Error("Summary unavailable"); return result as Record<string, unknown>; } });
    return NextResponse.json({ draftId: parsed.data.id, ...result });
  } catch (error) {
    if (error instanceof InterviewLimitError) return NextResponse.json({ error: { code: error.code, message: error.message, retryable: false, requestId: crypto.randomUUID(), limit: error.outcome } }, { status: error.status }); return error instanceof PreparationError ? mobileApiError(error.code, error.message, error.status) : mobileApiError("summary_unavailable", "Summary could not be loaded.", 503); }
}
