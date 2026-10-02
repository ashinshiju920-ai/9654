import { NextResponse } from "next/server";

import { checkAuthRateLimit, getCurrentSession } from "@/lib/auth";
import { requestEmailVerification } from "@/lib/auth/account-lifecycle-service";
import { getTrustedClientIdentity } from "@/lib/cloudflare/client-ip";

export async function POST(request: Request) {
  const current = await getCurrentSession();

  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientIdentity = await getTrustedClientIdentity(request);

  if (
    !(await checkAuthRateLimit({
      clientIdentity,
      purpose: "email-verification",
      subject: current.user.id,
    }))
  ) {
    return NextResponse.json(
      { error: "Too many verification email requests. Please try again later." },
      { status: 429 },
    );
  }

  let next: string | null = null;
  try {
    const body = (await request.json()) as { next?: unknown };
    next = typeof body.next === "string" ? body.next : null;
  } catch {
    next = null;
  }

  const result = await requestEmailVerification({
    userId: current.user.id,
    requestBaseUrl: request.url,
    next,
  });

  if (result.status === "missing_user") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
