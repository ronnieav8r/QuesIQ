import "./interview-synthetic";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { users, verificationTokens, accountPasswordResetTokens } from "@/server/db/schema";
import { requestOnboarding, verifyEmail, requireEmailDelivery } from "@/server/mobile-auth/onboarding";
import { accountLinkPage, accountLinkSubmit, onboardingRequest } from "@/server/mobile-auth/onboarding-http";
import { verifyPasswordCredentials, resetPasswordWithToken } from "@/server/auth/password-auth";
import { issueMobileTokenPair, rotateMobileRefreshToken } from "@/server/mobile-auth/mobile-auth";

async function main() {
  const email = `onboarding-${randomUUID()}@example.test`;
  const password = "OriginalSecure123!";
  const nextPassword = "ReplacementSecure456!";
  const emails: { textContent: string; to: {email:string}[] }[] = [];
  process.env.INTERVIEW_ONBOARDING_ENABLED = "1";
  process.env.INTERVIEW_AUTH_ORIGIN = "http://127.0.0.1:3100";
  process.env.BREVO_API_KEY = "local-mocked-email-key";
  process.env.AUTH_EMAIL_FROM = "local@example.test";
  process.env.MOBILE_AUTH_SECRET = "local-onboarding-test-secret-with-sufficient-length";
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://api.brevo.com/v3/smtp/email");
    emails.push(JSON.parse(String(init?.body)));
    return Response.json({messageId:"local-only"});
  };
  const body = {email,password,confirmPassword:password,firstName:"Local"};
  const cooldown = `interview-email-cooldown:${createHash("sha256").update(email).digest("hex")}`;
  const clearCooldown = () => getDb().delete(verificationTokens).where(eq(verificationTokens.identifier,cooldown));
  const linkFrom = (index:number) => new URL(emails[index].textContent.match(/http[^\s]+/)![0]);
  try {
    process.env.INTERVIEW_ONBOARDING_ENABLED="0";
    assert.throws(requireEmailDelivery);
    await assert.rejects(requestOnboarding("register",body));
    assert.equal((await getDb().select().from(users).where(eq(users.email,email))).length,0);
    process.env.INTERVIEW_ONBOARDING_ENABLED="1";
    await Promise.all([requestOnboarding("register",body),requestOnboarding("register",body)]);
    assert.equal(emails.length,1);
    assert.equal(await verifyPasswordCredentials(body),null);
    const link=linkFrom(0); const token=link.searchParams.get("token")!;
    assert.equal(link.pathname,"/api/mobile/v1/interview/auth/verify-email");
    const stored=await getDb().select().from(verificationTokens).where(eq(verificationTokens.identifier,"interview-verify:"+email));
    assert.notEqual(stored[0].token,token);
    assert.equal(accountLinkPage(new Request(link),"verify").status,200);
    assert.equal(await verifyPasswordCredentials(body),null, "GET must not verify an email scanner's visit");
    await assert.rejects(verifyEmail("other@example.test",token));
    await getDb().update(verificationTokens).set({expires:new Date(0)}).where(eq(verificationTokens.identifier,"interview-verify:"+email));
    await assert.rejects(verifyEmail(email,token));
    await getDb().update(verificationTokens).set({expires:new Date(Date.now()+60000)}).where(eq(verificationTokens.identifier,"interview-verify:"+email));
    const simultaneous=await Promise.allSettled([verifyEmail(email,token),verifyEmail(email,token)]);
    assert.equal(simultaneous.filter(r=>r.status==="fulfilled").length,1);
    const user=await verifyPasswordCredentials(body); assert.ok(user);
    await assert.rejects(verifyEmail(email,token));
    await clearCooldown(); await requestOnboarding("register",{...body,password:nextPassword,confirmPassword:nextPassword});
    assert.ok(await verifyPasswordCredentials(body)); assert.equal(emails.length,1,"duplicate signup must not replace credentials");
    const mobile=await issueMobileTokenPair({id:user.id,email});
    await clearCooldown(); await requestOnboarding("reset",{email});
    const resetLink=linkFrom(1);const resetToken=resetLink.searchParams.get("token")!;
    assert.equal(resetLink.pathname,"/api/mobile/v1/interview/auth/password-reset/confirm");
    assert.equal(accountLinkPage(new Request(resetLink),"reset").status,200);
    assert.ok(await verifyPasswordCredentials(body));
    await assert.rejects(resetPasswordWithToken({email,password:nextPassword,confirmPassword:"wrong",token:resetToken}));
    await clearCooldown(); await requestOnboarding("reset",{email});
    const anotherResetToken=linkFrom(2).searchParams.get("token")!;
    const resets=await Promise.allSettled([resetPasswordWithToken({email,password:nextPassword,confirmPassword:nextPassword,token:resetToken}),resetPasswordWithToken({email,password:nextPassword,confirmPassword:nextPassword,token:anotherResetToken})]);
    assert.equal(resets.filter(r=>r.status==="fulfilled").length,1);
    assert.equal(await verifyPasswordCredentials(body),null);
    assert.ok(await verifyPasswordCredentials({email,password:nextPassword}));
    await assert.rejects(rotateMobileRefreshToken(mobile.refreshToken));
    await assert.rejects(resetPasswordWithToken({email,password,confirmPassword:password,token:resetToken}));
    await clearCooldown(); await requestOnboarding("reset",{email});
    await getDb().update(accountPasswordResetTokens).set({expiresAt:new Date(0)}).where(eq(accountPasswordResetTokens.email,email));
    await assert.rejects(resetPasswordWithToken({email,password,confirmPassword:password,token:linkFrom(3).searchParams.get("token")}));
    const oversized=await onboardingRequest(new Request("http://local.test/register",{method:"POST",body:"x".repeat(9000)}),"register");assert.equal(oversized.status,413);
    const malformed=await onboardingRequest(new Request("http://local.test/register",{method:"POST",body:"null"}),"register");assert.equal(malformed.status,400);
    const invalid=await accountLinkSubmit(new Request("http://local.test/verify",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({email,token:"invalid"})}),"verify");assert.equal(invalid.status,400);
    const unknown = `unknown-${randomUUID()}@example.test`;
    const unknownHash = createHash("sha256").update(unknown).digest("hex");
    try {
      const before = emails.length;
      assert.equal(await requestOnboarding("reset", {email:unknown}), await requestOnboarding("resend", {email}));
      assert.equal(emails.length,before);
    } finally { await getDb().delete(verificationTokens).where(eq(verificationTokens.identifier,"interview-email-cooldown:"+unknownHash)); }
    console.log("PASS: disabled delivery, duplicate/concurrent signup, email verification single-use, scanner-safe GET, password reset validation/expiry/concurrency, credential preservation, refresh revocation and HTTP input bounds. All emails mocked; loopback database only.");
  } finally {
    await getDb().delete(verificationTokens).where(eq(verificationTokens.identifier,"interview-verify:"+email));
    await clearCooldown();
    await getDb().delete(users).where(eq(users.email,email));
  }
}
main().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1);});
