import { NextResponse } from "next/server";

import { checkAuthRateLimit } from "@/lib/auth";
import { resetPasswordWithToken } from "@/lib/auth/account-lifecycle-service";
import { validateNewPassword } from "@/lib/auth/account-lifecycle";
import { getTrustedClientIdentity } from "@/lib/cloudflare/client-ip";

export async function POST(request: Request) {
  const clientIdentity = await getTrustedClientIdentity(request);

  if (!(await checkAuthRateLimit({ clientIdentity, purpose: "password-reset" }))) {
    return NextResponse.json(
      { error: "Too many password reset attempts. Please try again later." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { token, password } = body as { token?: string; password?: string };

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  const passwordError = validateNewPassword(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  if (!token || typeof token !== "string") {
    return NextResponse.json(
      { error: "A valid reset token is required." },
      { status: 400 },
    );
  }

  const result = await resetPasswordWithToken({ token, password });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
