import { NextResponse } from "next/server";

import { checkAuthRateLimit } from "@/lib/auth";
import { safeAppPath } from "@/lib/auth/account-lifecycle";
import { verifyEmailToken } from "@/lib/auth/account-lifecycle-service";
import { getTrustedClientIdentity } from "@/lib/cloudflare/client-ip";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const next = safeAppPath(url.searchParams.get("next"), "/dashboard");
  const clientIdentity = await getTrustedClientIdentity(request);

  if (!(await checkAuthRateLimit({ clientIdentity, purpose: "email-verification" }))) {
    return redirectWithStatus(url, "/signup?verified=rate-limited");
  }

  if (!token) {
    return redirectWithStatus(url, "/signup?verified=invalid");
  }

  const result = await verifyEmailToken(token);

  if (result.status !== "verified") {
    return redirectWithStatus(url, "/signup?verified=invalid");
  }

  const destination = new URL(next, url.origin);
  destination.searchParams.set("verified", "1");
  return NextResponse.redirect(destination, { status: 303 });
}

function redirectWithStatus(requestUrl: URL, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, requestUrl.origin), { status: 303 });
}
