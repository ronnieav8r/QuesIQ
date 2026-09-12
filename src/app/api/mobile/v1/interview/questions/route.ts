import { NextResponse } from "next/server";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";
import { PreparationError } from "@/server/profiles/preparation";
import { readQuestionPreferences, mutateQuestionPreferences, savedSessionQuestions } from "@/server/interview/question-preferences";
export const runtime = "nodejs";
async function handle(request: Request) {
  const user = await resolveRequestUser(request); if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);
  try {
    const sessionId = new URL(request.url).searchParams.get("sessionId");
    return NextResponse.json(request.method === "GET" ? sessionId ? { questions: await savedSessionQuestions(user.id, sessionId) } : await readQuestionPreferences(user.id) : await mutateQuestionPreferences(user.id, await request.json()));
  } catch (error) { return error instanceof PreparationError ? mobileApiError(error.code, error.message, error.status) : mobileApiError("questions_unavailable", "Questions could not be loaded or saved. Retry without discarding your draft.", 503, true); }
}
export const GET = handle; export const PUT = handle;
