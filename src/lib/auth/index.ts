/**
 * Auth module barrel export.
 *
 * This file re-exports everything from the auth sub-modules so consumers
 * can import from `@/lib/auth` directly.
 */

export { hashPassword, hashPasswordAsync, verifyPassword, verifyPasswordAsync } from "./password";
export {
  createSession,
  getCurrentSession,
  getCurrentUser,
  invalidateSession,
  invalidateAllUserSessions,
  cleanExpiredSessions,
  SESSION_COOKIE_NAME,
  type SessionUser,
} from "./session";
export {
  requireUser,
  requireUserOrRedirect,
  requireAdmin,
  hasRole,
  AuthenticationError,
  AuthorizationError,
} from "./guard";
export {
  checkAuthRateLimit,
  checkLoginRateLimit,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_ATTEMPTS,
} from "./rate-limit";
export {
  generateAccountToken,
  hashAccountToken,
  safeAppPath,
  validateNewPassword,
} from "./account-lifecycle";
