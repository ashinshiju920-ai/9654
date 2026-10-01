import { describe, expect, it, vi } from "vitest";

let mockCloudflareEnv: unknown = null;

vi.mock("@/lib/cloudflare/runtime", () => ({
  getCloudflareEnv: vi.fn(() => Promise.resolve(mockCloudflareEnv)),
}));

import { checkAuthRateLimit } from "./rate-limit";

describe("Cloudflare auth rate limiter", () => {
  it("uses the Cloudflare Rate Limiting binding when present", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    mockCloudflareEnv = {
      AUTH_RATE_LIMITER: { limit },
    };

    await expect(
      checkAuthRateLimit({
        clientIdentity: "203.0.113.10",
        purpose: "login",
        subject: "student@example.com",
      }),
    ).resolves.toBe(false);

    expect(limit).toHaveBeenCalledWith({
      key: "login:203.0.113.10:student@example.com",
    });
  });

  it("fails closed in Cloudflare when the binding is missing", async () => {
    mockCloudflareEnv = {};

    await expect(
      checkAuthRateLimit({
        clientIdentity: "203.0.113.11",
        purpose: "password-reset",
      }),
    ).resolves.toBe(false);
  });
});
