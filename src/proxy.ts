import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "aylem_session";

// Routes that strictly require authentication
const PROTECTED_PREFIXES = [
  "/admin",
  "/dashboard",
  "/profile",
  "/results",
  "/advanced-mock-test",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // Root redirect at the edge: authenticated goes to dashboard, guest to public courses hub
  if (pathname === "/") {
    const dest = sessionToken ? "/dashboard" : "/courses";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Redirect legacy /login requests directly to /signup
  if (pathname === "/login") {
    if (sessionToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/signup";
    return NextResponse.redirect(redirectUrl);
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected) {
    if (!sessionToken) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/signup";
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // If authenticated user visits signup, redirect to dashboard
  if (pathname === "/signup") {
    if (sessionToken) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      dashboardUrl.searchParams.delete("next");
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/admin",
    "/admin/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/profile",
    "/profile/:path*",
    "/results",
    "/results/:path*",
    "/advanced-mock-test",
    "/advanced-mock-test/:path*",
    "/login",
    "/signup",
  ],
};
