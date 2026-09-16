import { mobileApiError } from "./responses";
import { OnboardingError, requestOnboarding, verifyEmail } from "./onboarding";
import { resetPasswordWithToken } from "@/server/auth/password-auth";

const attempts = new Map<string, { count: number; expires: number }>();
function throttle(request: Request) {
  const now = Date.now();
  for (const [key, item] of attempts) if (item.expires <= now) attempts.delete(key);
  // Render supplies the final forwarding hop. Also impose a process-wide ceiling.
  const ip = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
  for (const [key, limit] of [[`ip:${ip}`, 30], ["global", 300]] as const) {
    const item = attempts.get(key) || { count: 0, expires: now + 15 * 60_000 };
    if (++item.count > limit || attempts.size > 5000) throw new OnboardingError("Too many requests. Please try again in 15 minutes.", 429);
    attempts.set(key, item);
  }
}
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new OnboardingError("Account details are required.");
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.length;
      if (bytes > 8192) { await reader.cancel(); throw new OnboardingError("Request is too large.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    const body = request.headers.get("content-type")?.includes("application/x-www-form-urlencoded") ? Object.fromEntries(new URLSearchParams(text)) : JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new OnboardingError("Account details are invalid."); }
}
export async function onboardingRequest(request: Request, action: "register" | "resend" | "reset") {
  try {
    throttle(request);
    const message = await requestOnboarding(action, await readBody(request));
    return Response.json({ message }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return mobileApiError("account_request_failed", error instanceof OnboardingError ? error.message : "Account request could not be completed. Please try again later.", error instanceof OnboardingError ? error.status : 503);
  }
}
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
function page(title: string, content: string, status = 200) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · QuesIQ Interview</title><style>body{margin:0;background:#111824;color:#f7fafc;font:18px system-ui;line-height:1.5}main{max-width:440px;margin:8vh auto;padding:24px}h1{font-size:28px}label{display:block;margin-top:16px}input,button{box-sizing:border-box;width:100%;padding:14px;font:inherit;margin-top:8px;border-radius:8px;border:1px solid #a7b3c4}button{background:#f79447;color:#111824;cursor:pointer;margin-top:24px}a{color:#ffb781}p{overflow-wrap:anywhere}</style></head><body><main><p>QuesIQ Interview</p><h1>${escape(title)}</h1>${content}</main></body></html>`, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" } });
}
export function accountLinkPage(request: Request, kind: "verify" | "reset") {
  const url = new URL(request.url); const email = url.searchParams.get("email") || ""; const token = url.searchParams.get("token") || "";
  if (email.length > 254 || !/^[A-Za-z0-9_-]{43}$/.test(token)) return page("Link unavailable", "<p>This link is invalid. Request a new email in the Interview app.</p>", 400);
  const fields = kind === "reset" ? '<label>New password<input name="password" type="password" autocomplete="new-password" minlength="10" maxlength="128" required></label><label>Confirm password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="10" maxlength="128" required></label><p>Use 10–128 characters, including a letter and a number.</p>' : "";
  return page(kind === "verify" ? "Verify your email" : "Reset your password", `<p>${escape(email)}</p><form method="post" action="${escape(url.pathname)}"><input type="hidden" name="email" value="${escape(email)}"><input type="hidden" name="token" value="${escape(token)}">${fields}<button type="submit">${kind === "verify" ? "Verify email" : "Save new password"}</button></form><p>Only continue if you requested this email.</p>`);
}
export async function accountLinkSubmit(request: Request, kind: "verify" | "reset") {
  try {
    throttle(request);
    const body = await readBody(request);
    if (kind === "verify") await verifyEmail(body.email, body.token);
    else await resetPasswordWithToken(body);
    return page(kind === "verify" ? "Email verified" : "Password updated", "<p>Return to the QuesIQ Interview app and sign in.</p>");
  } catch (error) {
    const safe = error instanceof OnboardingError || (error instanceof Error && ["Passwords do not match.", "Password must be at least 10 characters.", "Password must be 128 characters or fewer.", "Password must include at least one letter and one number.", "Password reset link is invalid.", "Password reset link is invalid or expired."].includes(error.message));
    return page("Unable to continue", `<p role="alert">${escape(safe && error instanceof Error ? error.message : "We could not complete this request. Please try again later.")}</p><p>For a password entry error, go back and correct your entry. For an expired link, request a new email in the Interview app.</p>`, error instanceof OnboardingError ? error.status : safe ? 400 : 503);
  }
}
