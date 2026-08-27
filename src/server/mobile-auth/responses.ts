import { NextResponse } from "next/server";

export function mobileApiError(
  code: string,
  message: string,
  status: number,
  retryable = false,
) {
  const requestId = crypto.randomUUID();

  return NextResponse.json(
    { error: { code, message, requestId, retryable } },
    { headers: { "X-Request-Id": requestId }, status },
  );
}

export async function normalizeMobileResponse(response: Response) {
  if (response.ok) {
    return response;
  }

  const body = await response.clone().json().catch(() => undefined) as
    | { detail?: string; error?: string | { code?: string; message?: string } }
    | undefined;

  if (body?.error && typeof body.error === "object" && body.error.code && body.error.message) {
    return response;
  }

  const message = body?.detail ||
    (typeof body?.error === "string" ? body.error : undefined) ||
    "The request could not be completed.";

  return mobileApiError(
    response.status === 401 ? "unauthorized" : `request_failed_${response.status}`,
    message,
    response.status,
    response.status >= 500,
  );
}
