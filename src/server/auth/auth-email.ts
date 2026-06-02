type TransactionalEmailInput = {
  html: string;
  subject: string;
  text: string;
  to: string;
};

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

export async function sendTransactionalAuthEmail(input: TransactionalEmailInput) {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured.");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    body: JSON.stringify({
      htmlContent: input.html,
      sender: {
        email: senderEmail(),
        name: senderName(),
      },
      subject: input.subject,
      textContent: input.text,
      to: [{ email: input.to }],
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

    throw new Error(body?.message || "Brevo could not send the email.");
  }
}
