import { POST as createEvaluation } from "@/app/api/sessions/[sessionId]/evaluation/route";
import { mobileApiError, normalizeMobileResponse } from "@/server/mobile-auth/responses";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { getMobileReviewAccess } from "@/server/sessions/mobile-history";
import { getDb } from "@/server/db/client";
import { sessions } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  const { sessionId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) return mobileApiError("not_found", "Session was not found.", 404);
  try {
    const access = await getMobileReviewAccess(sessionId, user.id);
    if (!access) return mobileApiError("not_found", "Session was not found.", 404);
    if (!access.canRequest) return mobileApiError(`review_${access.kind}`, access.message, 409);
    const [session] = await getDb().select({ evaluationStatus: sessions.evaluationStatus }).from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)));
    if (session?.evaluationStatus === "failed") {
      const body = await request.clone().json().catch(() => undefined);
      if (body?.confirmRetry !== true) return mobileApiError("retry_confirmation", "Explicit confirmation is required before retrying evaluation.", 409);
    }
  } catch { return mobileApiError("review_unavailable", "Review status could not be checked; no evaluation was requested.", 503, true); }
  const response = await createEvaluation(request, context);
  // Legacy evaluation details can contain SQL/provider internals. Keep them off phones.
  if (response.status >= 500) return mobileApiError("review_request_failed", "The evaluation request did not complete. Refresh its status before retrying.", response.status, true);
  return normalizeMobileResponse(response);
}
