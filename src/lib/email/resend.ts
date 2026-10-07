import "server-only";

import { getRuntimeEnvValue } from "@/lib/cloudflare/runtime";

const RESEND_EMAILS_ENDPOINT = "https://api.resend.com/emails";

type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendTransactionalEmailResult =
  | { status: "sent"; id: string | null }
  | { status: "skipped"; reason: "missing_config" };

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<SendTransactionalEmailResult> {
  const apiKey = (await getRuntimeEnvValue("RESEND_API_KEY"))?.trim();
  const configuredFrom = (await getRuntimeEnvValue("RESEND_FROM_EMAIL"))?.trim();
  const from = configuredFrom || "Aylem Learning <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn("[Resend] Email delivery skipped: RESEND_API_KEY environment variable is missing.");
    return { status: "skipped", reason: "missing_config" };
  }

  const response = await fetch(RESEND_EMAILS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    let errorMessage = `Resend API failed with HTTP ${response.status}.`;
    try {
      const parsed = JSON.parse(errorBody) as { message?: string; name?: string };
      if (parsed.message) {
        errorMessage = `Resend API error (${response.status} ${parsed.name || ""}): ${parsed.message}`;
      }
    } catch {
      if (errorBody) errorMessage += ` ${errorBody}`;
    }
    console.error("[Resend]", errorMessage);
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as { id?: string };
  console.log(`[Resend] Successfully sent email "${input.subject}" to ${input.to} (id: ${data.id})`);
  return { status: "sent", id: data.id ?? null };
}

export async function getResendStatus(): Promise<{
  configured: boolean;
  hasApiKey: boolean;
  fromEmail: string;
}> {
  const apiKey = (await getRuntimeEnvValue("RESEND_API_KEY"))?.trim();
  const configuredFrom = (await getRuntimeEnvValue("RESEND_FROM_EMAIL"))?.trim();
  const from = configuredFrom || "Aylem Learning <onboarding@resend.dev>";

  return {
    configured: Boolean(apiKey),
    hasApiKey: Boolean(apiKey),
    fromEmail: from,
  };
}
