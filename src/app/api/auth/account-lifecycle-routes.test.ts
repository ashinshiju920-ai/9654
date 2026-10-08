import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/cloudflare/client-ip", () => ({
  getTrustedClientIdentity: vi.fn(async () => "203.0.113.10"),
}));

vi.mock("@/lib/auth", () => ({
  checkAuthRateLimit: vi.fn(async () => true),
  getCurrentSession: vi.fn(async () => null),
}));

vi.mock("@/lib/auth/account-lifecycle-service", () => ({
  GENERIC_FORGOT_PASSWORD_MESSAGE:
    "If an account exists with this email, password reset instructions will be sent.",
  requestPasswordReset: vi.fn(async () => undefined),
  resetPasswordWithToken: vi.fn(async () => ({ success: true })),
  requestEmailVerification: vi.fn(async () => ({ status: "sent" })),
  requestEmailVerificationByEmail: vi.fn(async () => ({ status: "sent" })),
  verifyEmailToken: vi.fn(async () => ({ status: "verified" })),
}));

import { checkAuthRateLimit, getCurrentSession } from "@/lib/auth";
import {
  requestPasswordReset,
  resetPasswordWithToken,
  requestEmailVerification,
  requestEmailVerificationByEmail,
  verifyEmailToken,
} from "@/lib/auth/account-lifecycle-service";

describe("account lifecycle routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkAuthRateLimit).mockResolvedValue(true);
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    vi.mocked(requestPasswordReset).mockResolvedValue(undefined);
    vi.mocked(resetPasswordWithToken).mockResolvedValue({ success: true });
    vi.mocked(requestEmailVerification).mockResolvedValue({ status: "sent" });
    vi.mocked(requestEmailVerificationByEmail).mockResolvedValue({ status: "sent" });
    vi.mocked(verifyEmailToken).mockResolvedValue({ status: "verified" });
  });

  it("returns the same forgot-password response for existing and nonexistent accounts", async () => {
    const { POST } = await import("./forgot-password/route");

    const existing = await POST(
      jsonRequest("/api/auth/forgot-password", { email: "user@example.com" }),
    );
    const missing = await POST(
      jsonRequest("/api/auth/forgot-password", { email: "missing@example.com" }),
    );

    expect(existing.status).toBe(200);
    expect(missing.status).toBe(200);
    expect(await existing.json()).toEqual(await missing.json());
    expect(
      JSON.stringify(
        await POST(jsonRequest("/api/auth/forgot-password", { email: "other@example.com" })).then(
          (r) => r.json(),
        ),
      ),
    ).not.toContain("token");
  });

  it("returns 429 for forgot-password rate limiting", async () => {
    vi.mocked(checkAuthRateLimit).mockResolvedValueOnce(false);
    const { POST } = await import("./forgot-password/route");

    const response = await POST(
      jsonRequest("/api/auth/forgot-password", { email: "user@example.com" }),
    );

    expect(response.status).toBe(429);
  });

  it("rejects reset token reuse or invalid tokens without exposing token material", async () => {
    vi.mocked(resetPasswordWithToken).mockResolvedValueOnce({
      success: false,
      error: "Invalid or expired reset token.",
    });
    const { POST } = await import("./reset-password/route");

    const response = await POST(
      jsonRequest("/api/auth/reset-password", {
        token: "raw-reset-token",
        password: "NewStrongPassword123!",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid or expired reset token.");
    expect(JSON.stringify(body)).not.toContain("raw-reset-token");
  });

  it("allows public resend requests by email without requiring an active session", async () => {
    const { POST } = await import("./resend-verification/route");

    const response = await POST(
      jsonRequest("/api/auth/resend-verification", {
        email: "USER@Example.com",
        next: "/courses/ielts",
      }),
    );

    expect(response.status).toBe(200);
    expect(requestEmailVerification).not.toHaveBeenCalled();
    expect(requestEmailVerificationByEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      requestBaseUrl: "https://preview.example/api/auth/resend-verification",
      next: "/courses/ielts",
    });
  });

  it("does not reveal whether an account exists when public resend has no matching user", async () => {
    vi.mocked(requestEmailVerificationByEmail).mockResolvedValueOnce({ status: "missing_user" });
    const { POST } = await import("./resend-verification/route");

    const response = await POST(
      jsonRequest("/api/auth/resend-verification", { email: "missing@example.com" }),
    );
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(200);
    expect(body.message).toContain("If an unverified account exists");
  });

  it("sanitizes verification redirects", async () => {
    const { GET } = await import("./verify-email/route");

    const response = await GET(
      new Request(
        "https://preview.example/api/auth/verify-email?token=ok&next=https://evil.example",
      ),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://preview.example/dashboard?verified=1");
  });
});

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`https://preview.example${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
