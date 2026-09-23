import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, like, or } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { users, verificationTokens } from "@/server/db/schema";
import { sendTransactionalAuthEmail } from "@/server/auth/auth-email";
import { createPasswordAccount, normalizeAccountEmail, parsePasswordAccountInput, requestPasswordReset, validatePassword } from "@/server/auth/password-auth";

export class OnboardingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const prefix = "interview-verify:";
export const inboxMessage = "If this address is eligible, an email is on its way. Check your inbox and spam folder. You can request another email after one minute.";

export function onboardingOrigin() {
  const origin = new URL(process.env.INTERVIEW_AUTH_ORIGIN || "http://127.0.0.1:3100");
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
      (origin.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname)))) {
    throw new OnboardingError("Account email is temporarily unavailable.", 503);
  }
  return origin.origin;
}
export function requireEmailDelivery() {
  if (process.env.INTERVIEW_ONBOARDING_ENABLED !== "1" || !process.env.RESEND_API_KEY || !process.env.AUTH_EMAIL_FROM) {
    throw new OnboardingError("Account email is not available yet. Please try again later.", 503);
  }
  onboardingOrigin();
}
function emailAddress(value: unknown) {
  const email = normalizeAccountEmail(value);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new OnboardingError("Enter a valid email address.");
  return email;
}
// Persistent per-address cooldown shared across restarts and all three email actions.
async function reserveEmail(email: string) {
  const identifier = `interview-email-cooldown:${digest(email)}`;
  const now = new Date();
  await getDb().delete(verificationTokens).where(and(
    or(like(verificationTokens.identifier, "interview-email-cooldown:%"), like(verificationTokens.identifier, "interview-verify:%")),
    lt(verificationTokens.expires, now),
  ));
  const inserted = await getDb().insert(verificationTokens).values({ identifier, token: "cooldown", expires: new Date(now.getTime() + 60_000) }).onConflictDoNothing().returning();
  return inserted.length > 0;
}
export async function sendVerification(email: string) {
  const [user] = await getDb().select({ verified: users.emailVerified }).from(users).where(eq(users.email, email)).limit(1);
  if (!user || user.verified) return;
  const token = randomBytes(32).toString("base64url");
  const identifier = prefix + email;
  const tokenHash = digest(token);
  await getDb().delete(verificationTokens).where(and(eq(verificationTokens.identifier, identifier), lt(verificationTokens.expires, new Date())));
  await getDb().insert(verificationTokens).values({ identifier, token: tokenHash, expires: new Date(Date.now() + 30 * 60_000) });
  const url = new URL("/api/mobile/v1/interview/auth/verify-email", onboardingOrigin());
  url.searchParams.set("email", email); url.searchParams.set("token", token);
  const link = url.toString();
  try {
    await sendTransactionalAuthEmail({ to: email, subject: "Verify your QuesIQ Interview email", text: `Verify your QuesIQ Interview email: ${link}\nThis link expires in 30 minutes. If you did not request an account, ignore this email.`, html: `<p>Verify your QuesIQ Interview email.</p><p><a href="${link.replaceAll("&", "&amp;")}">Verify email</a></p><p>This link expires in 30 minutes. If you did not request an account, ignore this email.</p>` });
  } catch {
    await getDb().delete(verificationTokens).where(and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, tokenHash)));
    throw new OnboardingError("We could not send the email. Wait one minute and try again.", 503);
  }
}
export async function requestOnboarding(action: "register" | "resend" | "reset", body: Record<string, unknown>) {
  requireEmailDelivery();
  const email = emailAddress(body.email);
  const input = parsePasswordAccountInput(body);
  if (action === "register") {
    if (!input || input.password !== input.confirmPassword) throw new OnboardingError("Passwords do not match.");
    const error = validatePassword(input.password || "");
    if (error) throw new OnboardingError(error);
  }
  if (!await reserveEmail(email)) return inboxMessage;
  if (action === "register") {
    const [existing] = await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    // Never overwrite a password or profile during a duplicate registration.
    if (!existing) {
      try { await createPasswordAccount(input!); }
      catch (error) {
        const code = (error as { code?: string; cause?: { code?: string } }).cause?.code || (error as { code?: string }).code;
        if (code !== "23505") throw error;
      }
    }
  }
  if (action === "reset") {
    try { await requestPasswordReset({ email, origin: onboardingOrigin(), resetPath: "/api/mobile/v1/interview/auth/password-reset/confirm" }); }
    catch { throw new OnboardingError("We could not send the email. Wait one minute and try again.", 503); }
  } else await sendVerification(email);
  return inboxMessage;
}
export async function verifyEmail(emailValue: unknown, tokenValue: unknown) {
  const email = emailAddress(emailValue);
  if (typeof tokenValue !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(tokenValue)) throw new OnboardingError("This verification link is invalid or expired.");
  const identifier = prefix + email;
  await getDb().transaction(async tx => {
    const [claimed] = await tx.delete(verificationTokens).where(and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, digest(tokenValue)), gt(verificationTokens.expires, new Date()))).returning();
    if (!claimed) throw new OnboardingError("This verification link is invalid or expired.");
    const [user] = await tx.update(users).set({ emailVerified: new Date() }).where(eq(users.email, email)).returning({ id: users.id });
    if (!user) throw new OnboardingError("This verification link is invalid or expired.");
    await tx.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier));
  });
}
