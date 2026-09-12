export const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:3100")
  .replace(/\/$/, "");

export type InterviewLimit = {
  message: string;
  reason: string;
  recoveryActions: string[];
  resetAt?: string;
  review: "reserved" | "deferred";
};

export class MobileApiError extends Error {
  code: string;
  limit?: InterviewLimit;
  retryable: boolean;
  status: number;

  constructor(message: string, options: { code?: string; limit?: InterviewLimit; retryable?: boolean; status: number }) {
    super(message);
    this.name = "MobileApiError";
    this.code = options.code || `http_${options.status}`;
    this.limit = options.limit;
    this.retryable = options.retryable ?? options.status >= 500;
    this.status = options.status;
  }
}

export function interviewLimitFromError(error: unknown) {
  return error instanceof MobileApiError && error.code === "interview_limit" ? error.limit : undefined;
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;

  const body = await response.json().catch(() => undefined) as {
    detail?: string;
    error?: string | { code?: string; limit?: InterviewLimit; message?: string; retryable?: boolean };
  } | undefined;
  const structured = body?.error && typeof body.error === "object" ? body.error : undefined;
  const message = structured?.message || body?.detail ||
    (typeof body?.error === "string" ? body.error : undefined) ||
    "The request could not be completed.";

  throw new MobileApiError(message, {
    code: structured?.code,
    limit: structured?.limit,
    retryable: structured?.retryable,
    status: response.status,
  });
}
