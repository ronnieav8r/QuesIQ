import { MobileApiError, type InterviewLimit } from "@/lib/api";

type ErrorBody = { detail?: string; error?: string | { code?: string; limit?: InterviewLimit; message?: string; retryable?: boolean } };

export async function responseLimitError(response: Response) {
  const body = await response.json().catch(() => undefined) as ErrorBody | undefined;
  const structured = body?.error && typeof body.error === "object" ? body.error : undefined;
  if (response.status !== 429 || structured?.code !== "interview_limit") return undefined;
  return new MobileApiError(structured.message || body?.detail || "Practice is paused for account safety.", {
    code: structured.code,
    limit: structured.limit,
    retryable: structured.retryable,
    status: response.status,
  });
}

export function limitPauseMessage(limit?: InterviewLimit) {
  return limit?.message || "Practice is paused for account safety. Your committed transcript will be saved before you leave this screen.";
}
