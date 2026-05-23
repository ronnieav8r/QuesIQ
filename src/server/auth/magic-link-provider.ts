import type { EmailConfig } from "@auth/core/providers/email";

type BrevoEmailResponse = {
  code?: string;
  message?: string;
};

function senderName() {
  return process.env.AUTH_EMAIL_FROM_NAME || "QuesIQ";
}

function senderEmail() {
  return process.env.AUTH_EMAIL_FROM || "no-reply@quesiq.com";
}

function buildEmailHtml(url: string) {
  return `
    <div style="font-family: Arial, sans-serif; color: #101521; line-height: 1.5;">
      <h1 style="font-size: 22px;">Sign in to QuesIQ</h1>
      <p>Use this secure link to continue your interview practice.</p>
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
    "Use this secure link to continue your interview practice:",
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
      const apiKey = process.env.BREVO_API_KEY;

      if (!apiKey) {
        throw new Error("BREVO_API_KEY is not configured.");
      }

      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        body: JSON.stringify({
          htmlContent: buildEmailHtml(url),
          sender: {
            email: senderEmail(),
            name: senderName(),
          },
          subject: "Sign in to QuesIQ",
          textContent: buildEmailText(url),
          to: [{ email: identifier }],
        }),
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        method: "POST",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => undefined)) as
          | BrevoEmailResponse
          | undefined;

        throw new Error(body?.message || "Brevo could not send the sign-in email.");
      }
    },
  };
}
