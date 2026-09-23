type TransactionalEmailInput = {
  html: string;
  subject: string;
  text: string;
  to: string;
};

type ResendEmailResponse = {
  message?: string;
};

function senderName() {
  return process.env.AUTH_EMAIL_FROM_NAME || "QuesIQ";
}

function senderEmail() {
  return process.env.AUTH_EMAIL_FROM || "no-reply@quesiq.com";
}

export async function sendTransactionalAuthEmail(input: TransactionalEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      html: input.html,
      from: `${senderName()} <${senderEmail()}>`,
      subject: input.subject,
      text: input.text,
      to: [input.to],
    }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as
      | ResendEmailResponse
      | undefined;

    throw new Error(body?.message || "Resend could not send the email.");
  }
}
