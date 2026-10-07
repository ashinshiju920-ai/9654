import { Buffer } from "node:buffer";
import { createHash, randomBytes } from "node:crypto";

export const ACCOUNT_TOKEN_BYTES = 32;
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export const GENERIC_FORGOT_PASSWORD_MESSAGE =
  "If an account exists with this email, password reset instructions will be sent.";

export function generateAccountToken(): string {
  return Buffer.from(randomBytes(ACCOUNT_TOKEN_BYTES)).toString("base64url");
}

export function hashAccountToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateNewPassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  if (password.length > 256) {
    return "Password is too long.";
  }

  return null;
}

export function isTokenUsable(input: {
  expiresAt: Date;
  usedAt: Date | null;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  return !input.usedAt && input.expiresAt.getTime() > now.getTime();
}

export function safeAppPath(candidate: string | null | undefined, fallback = "/courses"): string {
  if (!candidate) {
    return fallback;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, "https://portal.local");

    if (parsed.origin !== "https://portal.local") {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function buildActionUrl(input: {
  baseUrl: string;
  path: string;
  token: string;
  next?: string | null;
}): string {
  const url = new URL(input.path, input.baseUrl);
  url.searchParams.set("token", input.token);

  const next = safeAppPath(input.next, "");
  if (next) {
    url.searchParams.set("next", next);
  }

  return url.toString();
}
