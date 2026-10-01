import { describe, expect, it, vi } from "vitest";

let mockCloudflareEnv: unknown = null;

vi.mock("./runtime", () => ({
  getCloudflareEnv: vi.fn(() => Promise.resolve(mockCloudflareEnv)),
}));

import { getTrustedClientIdentity } from "./client-ip";

describe("Cloudflare client identity", () => {
  it("uses cf-connecting-ip when running inside Cloudflare", async () => {
    mockCloudflareEnv = {};
    const request = new Request("https://portal.example.test/login", {
      headers: {
        "cf-connecting-ip": "203.0.113.20",
        "x-real-ip": "10.0.0.5",
      },
    });

    await expect(getTrustedClientIdentity(request)).resolves.toBe("203.0.113.20");
  });

  it("uses local development fallback outside Cloudflare", async () => {
    mockCloudflareEnv = null;
    const request = new Request("http://localhost:3000/login", {
      headers: {
        "x-real-ip": "127.0.0.1",
      },
    });

    await expect(getTrustedClientIdentity(request)).resolves.toBe("127.0.0.1");
  });
});
