import "server-only";

import { Buffer } from "node:buffer";
import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { eq, and, gt, lt } from "drizzle-orm";

import { isProductionRuntime } from "@/lib/cloudflare/runtime";
import { getDb } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Cookie name for the session token. */
export const SESSION_COOKIE_NAME = "aylem_session";

/** Raw token length in bytes (256 bits of entropy). */
const TOKEN_BYTES = 32;

/** Session duration: 7 days in milliseconds. */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Update `last_used_at` at most once every 5 minutes to avoid excessive writes. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  accountStatus: string;
};

/* ------------------------------------------------------------------ */
/*  Token utilities                                                    */
/* ------------------------------------------------------------------ */

/**
 * Generate a cryptographically secure random session token.
 * Returns the raw hex-encoded token (sent to the browser as a cookie).
 */
function generateSessionToken(): string {
  return Buffer.from(randomBytes(TOKEN_BYTES)).toString("hex");
}

/**
 * Hash a raw session token with SHA-256 before database storage.
 * The database never stores the raw token.
 */
function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/* ------------------------------------------------------------------ */
/*  Session CRUD                                                       */
/* ------------------------------------------------------------------ */

/**
 * Create a new session for the given user.
 *
 * 1. Generates a random token
 * 2. Stores the SHA-256 hash in the `sessions` table
 * 3. Sets the raw token as an HTTP-only cookie
 *
 * @returns The session row id.
 */
export async function createSession(userId: string): Promise<string> {
  const db = await getDb();
  const rawToken = generateSessionToken();
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  const [row] = await db
    .insert(sessions)
    .values({
      userId,
      tokenHash,
      expiresAt,
      lastUsedAt: now,
    })
    .returning({ id: sessions.id });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: await isProductionRuntime(),
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });

  return row.id;
}

/**
 * Read the session cookie, look up the session in the database,
 * and return the associated user if the session is valid.
 *
 * Returns `null` if no session exists, is expired, or the account is suspended.
 *
 * Automatically touches `last_used_at` to track activity.
 */
export async function getCurrentSession(): Promise<{
  session: { id: string; expiresAt: Date };
  user: SessionUser;
} | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const db = await getDb();

  const result = await db
    .select({
      sessionId: sessions.id,
      sessionExpiresAt: sessions.expiresAt,
      sessionLastUsedAt: sessions.lastUsedAt,
      userId: users.id,
      userEmail: users.email,
      userFullName: users.fullName,
      userRole: users.role,
      userAccountStatus: users.accountStatus,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const row = result[0];

  // Reject suspended/pending accounts
  if (row.userAccountStatus !== "active") {
    return null;
  }

  // Touch `last_used_at` if stale (fire-and-forget, don't block the response)
  if (now.getTime() - row.sessionLastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    void db
      .update(sessions)
      .set({ lastUsedAt: now })
      .where(eq(sessions.id, row.sessionId))
      .execute();
  }

  return {
    session: { id: row.sessionId, expiresAt: row.sessionExpiresAt },
    user: {
      id: row.userId,
      email: row.userEmail,
      fullName: row.userFullName,
      role: row.userRole,
      accountStatus: row.userAccountStatus,
    },
  };
}

/**
 * Convenience wrapper: return the current user or `null`.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const result = await getCurrentSession();
  return result?.user ?? null;
}

/**
 * Invalidate (delete) a single session by its database id.
 * Also clears the session cookie.
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: await isProductionRuntime(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Invalidate ALL sessions for a user (e.g. password change, account compromise).
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Delete expired sessions from the database.
 * Intended to be called periodically (e.g. cron, or inline with low frequency).
 */
export async function cleanExpiredSessions(): Promise<number> {
  const db = await getDb();
  const result = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .returning({ id: sessions.id });

  return result.length;
}
