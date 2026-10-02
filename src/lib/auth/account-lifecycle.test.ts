import { describe, expect, it } from "vitest";

import {
  ACCOUNT_TOKEN_BYTES,
  buildActionUrl,
  generateAccountToken,
  hashAccountToken,
  isTokenUsable,
  safeAppPath,
  validateNewPassword,
} from "./account-lifecycle";
import {
  resetPasswordTemplate,
  verifyEmailTemplate,
  passwordChangedTemplate,
} from "@/lib/email/templates";

describe("account lifecycle security helpers", () => {
  it("generates high-entropy URL-safe tokens and stores only stable hashes", () => {
    const token = generateAccountToken();
    const secondToken = generateAccountToken();

    expect(token).not.toBe(secondToken);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(ACCOUNT_TOKEN_BYTES);

    const hash = hashAccountToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(hashAccountToken(token));
    expect(hash).not.toContain(token);
  });

  it("rejects used or expired tokens", () => {
    const now = new Date("2026-10-02T12:00:00.000Z");

    expect(
      isTokenUsable({
        expiresAt: new Date("2026-10-02T12:01:00.000Z"),
        usedAt: null,
        now,
      }),
    ).toBe(true);
    expect(
      isTokenUsable({
        expiresAt: new Date("2026-10-02T11:59:00.000Z"),
        usedAt: null,
        now,
      }),
    ).toBe(false);
    expect(
      isTokenUsable({
        expiresAt: new Date("2026-10-02T12:01:00.000Z"),
        usedAt: now,
        now,
      }),
    ).toBe(false);
  });

  it("allows only same-application relative redirect destinations", () => {
    expect(safeAppPath("/dashboard?verified=1")).toBe("/dashboard?verified=1");
    expect(safeAppPath("https://evil.example/phish")).toBe("/login");
    expect(safeAppPath("//evil.example/phish")).toBe("/login");
    expect(safeAppPath("/\\evil")).toBe("/login");
  });

  it("builds action URLs without exposing tokens outside the URL destination", () => {
    const url = buildActionUrl({
      baseUrl: "https://preview.example",
      path: "/reset-password",
      token: "raw-token",
      next: "https://evil.example",
    });

    expect(url).toBe("https://preview.example/reset-password?token=raw-token");
  });

  it("validates reset password length boundaries", () => {
    expect(validateNewPassword("short")).toBe("Password must be at least 8 characters long.");
    expect(validateNewPassword("CorrectHorse1")).toBeNull();
    expect(validateNewPassword("x".repeat(257))).toBe("Password is too long.");
  });

  it("renders transactional templates without embedding secret-like token labels", () => {
    const verify = verifyEmailTemplate({
      fullName: "Preview Student",
      actionUrl: "https://preview.example/api/auth/verify-email?token=abc",
    });
    const reset = resetPasswordTemplate({
      fullName: "Preview Student",
      actionUrl: "https://preview.example/reset-password?token=def",
    });
    const changed = passwordChangedTemplate({ fullName: "Preview Student" });

    expect(verify.subject).toContain("Verify");
    expect(reset.subject).toContain("Reset");
    expect(changed.subject).toContain("password was changed");
    expect(verify.html).toContain("Aylem Learning");
    expect(reset.text).not.toContain("RESEND_API_KEY");
    expect(changed.html).not.toContain("session");
  });
});
