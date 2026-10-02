import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { getCurrentSession, type SessionUser } from "./session";

/**
 * Require an authenticated user or redirect to login.
 *
 * Specifically designed for Next.js Server Components.
 */
export async function requireUserOrRedirect(redirectTo = "/login"): Promise<SessionUser> {
  const result = await getCurrentSession();

  if (!result) {
    redirect(redirectTo);
  }

  return result.user;
}

/**
 * Require an authenticated admin user or redirect.
 *
 * Specifically designed for Next.js Server Components in the /admin area.
 */
export async function requireAdminOrRedirect(redirectTo = "/login"): Promise<SessionUser> {
  const result = await getCurrentSession();

  if (!result) {
    redirect(redirectTo);
  }

  if (result.user.role !== "admin") {
    redirect("/dashboard?error=admin-required");
  }

  return result.user;
}

/**
 * Require an authenticated user.
 *
 * Returns the user if a valid session exists; otherwise throws an error
 * that can be caught by the caller to redirect or return 401.
 */
export async function requireUser(): Promise<SessionUser> {
  const result = await getCurrentSession();

  if (!result) {
    throw new AuthenticationError("You must be logged in to access this resource.");
  }

  return result.user;
}

/**
 * Require an authenticated admin user.
 *
 * Returns the user if they have the `admin` role; throws otherwise.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();

  if (user.accountStatus === "suspended") {
    throw new AuthorizationError("Account is suspended.");
  }

  if (user.role !== "admin") {
    throw new AuthorizationError("You do not have permission to access this resource.");
  }

  return user;
}

export async function requireAdminApi(): Promise<
  { user: SessionUser; errorResponse?: never } | { user?: never; errorResponse: NextResponse }
> {
  try {
    const user = await requireAdmin();
    return { user };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {
        errorResponse: NextResponse.json(
          { error: "Forbidden: Admin access required." },
          { status: 403 },
        ),
      };
    }
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Please log in." },
        { status: 401 },
      ),
    };
  }
}

/**
 * Check whether the current user has a specific role.
 * Returns `false` if not authenticated.
 */
export async function hasRole(role: string): Promise<boolean> {
  const result = await getCurrentSession();
  return result?.user.role === role;
}

/* ------------------------------------------------------------------ */
/*  Error classes                                                      */
/* ------------------------------------------------------------------ */

export class AuthenticationError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message = "Insufficient permissions.") {
    super(message);
    this.name = "AuthorizationError";
  }
}
