/**
 * Safe redirect destination validator to prevent Open Redirect vulnerabilities.
 * Only permits internal, relative application paths.
 */
export function getSafeRedirectUrl(rawUrl?: string | null, fallback = "/dashboard"): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    return fallback;
  }

  const trimmed = rawUrl.trim();

  // Must begin with a single slash
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  // Must not contain scheme indicators or backslashes
  if (trimmed.includes("://") || trimmed.includes("\\") || trimmed.includes("\0")) {
    return fallback;
  }

  // Prevent protocol-relative evasion like "/\\evil.com"
  if (/^\/[/\\]/.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}
