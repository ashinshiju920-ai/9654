import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "aylem_session";

// Routes that require authentication
const PROTECTED_PREFIXES = [
  "/admin",
  "/dashboard",
  "/courses",
  "/profile",
  "/results",
  "/advanced-mock-test",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Root redirect at the edge to avoid expensive SSR evaluation
  if (pathname === "/") {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const dest = sessionToken ? "/dashboard" : "/login";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected) {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // If authenticated user visits login or signup, redirect to dashboard
  if (pathname === "/login" || pathname === "/signup") {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
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
    "/courses",
    "/courses/:path*",
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
