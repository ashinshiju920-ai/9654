import "server-only";

/**
 * In-memory login rate limiter.
 *
 * This provides application-level brute-force protection for the login
 * endpoint.  For production, infrastructure-level rate limiting (e.g. Nginx
 * `limit_req`) should also be configured.
 *
 * The in-memory map is reset on server restart, which is acceptable for a
 * single-process Next.js deployment on one VPS.
 *
 * Keyed by IP address so an attacker cannot lock out legitimate users by
 * targeting their email address.
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

/**
 * Check whether a login attempt from the given IP should be allowed.
 *
 * @returns `true` if the attempt is allowed, `false` if rate-limited.
 */
export function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    attempts.set(ip, { count: 1, windowStart: now });
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
 * Called automatically on a 30-minute interval.
 */
function cleanStaleEntries() {
  const now = Date.now();

  for (const [key, entry] of attempts) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

// Self-cleaning interval — runs as long as the process lives.
if (typeof globalThis !== "undefined") {
  const cleanupInterval = setInterval(cleanStaleEntries, 30 * 60 * 1000);
  // Allow the process to exit even if this timer is active.
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}
