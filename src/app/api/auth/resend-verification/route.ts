import { NextResponse } from "next/server";

import { checkAuthRateLimit, getCurrentSession } from "@/lib/auth";
import {
  requestEmailVerification,
  requestEmailVerificationByEmail,
} from "@/lib/auth/account-lifecycle-service";
import { getTrustedClientIdentity } from "@/lib/cloudflare/client-ip";

export async function POST(request: Request) {
  const current = await getCurrentSession();
  const clientIdentity = await getTrustedClientIdentity(request);

  let email: string | null = null;
  let next: string | null = null;
  try {
    const body = (await request.json()) as { email?: unknown; next?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
    next = typeof body.next === "string" ? body.next : null;
  } catch {
    email = null;
    next = null;
  }

  const subject = current?.user.id || email || clientIdentity;

  if (
    !(await checkAuthRateLimit({
      clientIdentity,
      purpose: "email-verification",
      subject,
    }))
  ) {
    return NextResponse.json(
      { error: "Too many verification email requests. Please try again later." },
      { status: 429 },
    );
  }

  const result = current
    ? await requestEmailVerification({
        userId: current.user.id,
        requestBaseUrl: request.url,
        next,
      })
    : email
      ? await requestEmailVerificationByEmail({
          email,
          requestBaseUrl: request.url,
          next,
        })
      : { status: "missing_user" as const };

  if (result.status === "missing_user") {
    return NextResponse.json({
      success: true,
      message: "If an unverified account exists for this email, a verification email will be sent.",
    });
  }

  if (result.status === "email_not_configured") {
    return NextResponse.json(
      { error: "Email delivery is not configured for this preview environment." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    success: true,
    message:
      result.status === "already_verified"
        ? "Email address is already verified."
        : "Verification email sent.",
  });
}
