import "server-only";

import { getCloudflareEnv } from "@/lib/cloudflare/runtime";

/**
 * Authentication rate limiting.
 *
 * Cloudflare Workers production uses the AUTH_RATE_LIMITER binding. The local
 * in-memory fallback is only for Next.js development/tests when no Cloudflare
 * binding exists.
 */

/** Maximum login attempts per window. */
export const RATE_LIMIT_MAX_ATTEMPTS = 10;

/** Window duration in milliseconds (15 minutes). */
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

type RateLimitEntry = {
  count: number;
  windowStart: number;
};

const attempts = new Map<string, RateLimitEntry>();
let lastCleanupAt = 0;

/**
 * Check whether a login attempt from the given IP should be allowed.
 *
 * @returns `true` if the attempt is allowed, `false` if rate-limited.
 */
export async function checkAuthRateLimit(input: {
  clientIdentity: string;
  purpose: "login" | "password-reset" | "otp";
  subject?: string;
}): Promise<boolean> {
  const cloudflareEnv = await getCloudflareEnv();
  const limiter = cloudflareEnv?.AUTH_RATE_LIMITER;
  const subject = input.subject ? `:${input.subject}` : "";
  const key = `${input.purpose}:${input.clientIdentity}${subject}`;

  if (limiter) {
    try {
      const result = await limiter.limit({ key });
      return result.success;
    } catch {
      return false;
    }
  }

  if (cloudflareEnv) {
    return false;
  }

  return checkLocalRateLimit(key);
}

export function checkLoginRateLimit(ip: string): boolean {
  return checkLocalRateLimit(`login:${ip}`);
}

function checkLocalRateLimit(key: string): boolean {
  const now = Date.now();
  cleanStaleEntries(now);
  const entry = attempts.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now });
    return true;
  }

  entry.count += 1;

  if (entry.count > RATE_LIMIT_MAX_ATTEMPTS) {
    return false;
  }

  return true;
}

/**
 * Periodically clean stale entries to prevent memory leaks.
 * Runs opportunistically so the module remains safe to load in Workers.
 */
function cleanStaleEntries(now: number) {
  if (now - lastCleanupAt < RATE_LIMIT_WINDOW_MS) {
    return;
  }

  lastCleanupAt = now;

  for (const [key, entry] of attempts) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      attempts.delete(key);
    }
  }
}
