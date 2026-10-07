import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getResendStatus, sendTransactionalEmail } from "./resend";

vi.mock("@/lib/cloudflare/runtime", () => ({
  getRuntimeEnvValue: vi.fn(),
}));

describe("resend email service", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("skips sending when RESEND_API_KEY is not configured", async () => {
    const { getRuntimeEnvValue } = await import("@/lib/cloudflare/runtime");
    vi.mocked(getRuntimeEnvValue).mockResolvedValue(undefined);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await sendTransactionalEmail({
      to: "student@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
      text: "Hello",
    });

    expect(result).toEqual({ status: "skipped", reason: "missing_config" });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("RESEND_API_KEY environment variable is missing"),
    );
  });

  it("falls back to default onboarding sender when RESEND_FROM_EMAIL is not configured", async () => {
    const { getRuntimeEnvValue } = await import("@/lib/cloudflare/runtime");
    vi.mocked(getRuntimeEnvValue).mockImplementation(async (key: string) => {
      if (key === "RESEND_API_KEY") return "re_test_key_123";
      return undefined;
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_123" }),
    });
    globalThis.fetch = mockFetch;

    const result = await sendTransactionalEmail({
      to: "student@example.com",
      subject: "Welcome",
      html: "<p>Welcome</p>",
      text: "Welcome",
    });

    expect(result).toEqual({ status: "sent", id: "email_123" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer re_test_key_123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Aylem Learning <onboarding@resend.dev>",
          to: ["student@example.com"],
          subject: "Welcome",
          html: "<p>Welcome</p>",
          text: "Welcome",
        }),
      }),
    );
  });

  it("uses custom RESEND_FROM_EMAIL when provided", async () => {
    const { getRuntimeEnvValue } = await import("@/lib/cloudflare/runtime");
    vi.mocked(getRuntimeEnvValue).mockImplementation(async (key: string) => {
      if (key === "RESEND_API_KEY") return "re_test_key_123";
      if (key === "RESEND_FROM_EMAIL") return "Aylem <support@aylemlearning.online>";
      return undefined;
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_456" }),
    });
    globalThis.fetch = mockFetch;

    const result = await sendTransactionalEmail({
      to: "student@example.com",
      subject: "Welcome",
      html: "<p>Welcome</p>",
      text: "Welcome",
    });

    expect(result).toEqual({ status: "sent", id: "email_456" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        body: JSON.stringify({
          from: "Aylem <support@aylemlearning.online>",
          to: ["student@example.com"],
          subject: "Welcome",
          html: "<p>Welcome</p>",
          text: "Welcome",
        }),
      }),
    );
  });

  it("throws descriptive error when Resend API responds with non-ok status", async () => {
    const { getRuntimeEnvValue } = await import("@/lib/cloudflare/runtime");
    vi.mocked(getRuntimeEnvValue).mockImplementation(async (key: string) => {
      if (key === "RESEND_API_KEY") return "re_test_key_123";
      return undefined;
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () =>
        JSON.stringify({
          statusCode: 403,
          name: "validation_error",
          message: "You can only send testing emails to your own email address.",
        }),
    });
    globalThis.fetch = mockFetch;

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendTransactionalEmail({
        to: "other@example.com",
        subject: "Welcome",
        html: "<p>Welcome</p>",
        text: "Welcome",
      }),
    ).rejects.toThrow("Resend API error (403 validation_error): You can only send testing emails");

    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns status object with getResendStatus", async () => {
    const { getRuntimeEnvValue } = await import("@/lib/cloudflare/runtime");
    vi.mocked(getRuntimeEnvValue).mockImplementation(async (key: string) => {
      if (key === "RESEND_API_KEY") return "re_abc";
      if (key === "RESEND_FROM_EMAIL") return "Custom <noreply@domain.com>";
      return undefined;
    });

    const status = await getResendStatus();
    expect(status).toEqual({
      configured: true,
      hasApiKey: true,
      fromEmail: "Custom <noreply@domain.com>",
    });
  });
});
