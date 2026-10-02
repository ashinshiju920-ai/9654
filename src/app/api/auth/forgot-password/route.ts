import { NextResponse } from "next/server";

import { checkAuthRateLimit } from "@/lib/auth";
import {
  GENERIC_FORGOT_PASSWORD_MESSAGE,
  requestPasswordReset,
} from "@/lib/auth/account-lifecycle-service";
import { normalizeEmail } from "@/lib/auth/account-lifecycle";
import { getTrustedClientIdentity } from "@/lib/cloudflare/client-ip";

export async function POST(request: Request) {
  const clientIdentity = await getTrustedClientIdentity(request);
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { email } = body as { email?: string };

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email address is required." }, { status: 400 });
  }

  const subject = normalizeEmail(email);
  const allowed = await checkAuthRateLimit({
    clientIdentity,
    purpose: "forgot-password",
    subject,
  });

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many password reset requests. Please try again later." },
      { status: 429 },
    );
  }

  await requestPasswordReset(email, request.url);

  return NextResponse.json({
    success: true,
    message: GENERIC_FORGOT_PASSWORD_MESSAGE,
  });
}
