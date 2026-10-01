import { describe, expect, it } from "vitest";

import { checkLoginRateLimit, RATE_LIMIT_MAX_ATTEMPTS } from "./rate-limit";

describe("Login Rate Limiter", () => {
  it("allows attempts up to maximum within the window", () => {
    const testIp = `192.168.1.${Math.floor(Math.random() * 200 + 10)}`;

    for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) {
      expect(checkLoginRateLimit(testIp)).toBe(true);
    }

    // 11th attempt must be blocked
    expect(checkLoginRateLimit(testIp)).toBe(false);
  });

  it("tracks different IPs independently", () => {
    const ipA = "10.0.0.1";
    const ipB = "10.0.0.2";

    // Max out ipA
    for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) {
      checkLoginRateLimit(ipA);
    }
    expect(checkLoginRateLimit(ipA)).toBe(false);

    // ipB should still be allowed
    expect(checkLoginRateLimit(ipB)).toBe(true);
  });
});
