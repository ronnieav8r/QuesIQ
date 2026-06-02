import type { EmailConfig } from "@auth/core/providers/email";

import { sendTransactionalAuthEmail } from "@/server/auth/auth-email";

function buildEmailHtml(url: string) {
  return `
    <div style="font-family: Arial, sans-serif; color: #101521; line-height: 1.5;">
      <h1 style="font-size: 22px;">Sign in to QuesIQ</h1>
      <p>Use this secure link to continue to your QuesIQ account.</p>
      <p>
        <a href="${url}" style="background: #e8721a; color: #ffffff; display: inline-block; padding: 12px 18px; text-decoration: none; border-radius: 6px; font-weight: 700;">
          Continue to QuesIQ
        </a>
      </p>
      <p style="color: #455069; font-size: 14px;">This link expires soon. If you did not request it, you can ignore this email.</p>
    </div>
  `;
}

function buildEmailText(url: string) {
  return [
    "Sign in to QuesIQ",
    "",
    "Use this secure link to continue to your QuesIQ account:",
    url,
    "",
    "If you did not request it, you can ignore this email.",
  ].join("\n");
}

export function MagicLinkProvider(): EmailConfig {
  return {
    id: "email",
    maxAge: 15 * 60,
    name: "Email",
    type: "email",
    async sendVerificationRequest({ identifier, url }) {
      await sendTransactionalAuthEmail({
        html: buildEmailHtml(url),
        subject: "Sign in to QuesIQ",
        text: buildEmailText(url),
        to: identifier,
      });
    },
  };
}
