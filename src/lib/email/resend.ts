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
  const apiKey = await getRuntimeEnvValue("RESEND_API_KEY");
  const from = await getRuntimeEnvValue("RESEND_FROM_EMAIL");

  if (!apiKey || !from) {
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
    throw new Error(`Resend email send failed with status ${response.status}.`);
  }

  const data = (await response.json()) as { id?: string };
  return { status: "sent", id: data.id ?? null };
}
