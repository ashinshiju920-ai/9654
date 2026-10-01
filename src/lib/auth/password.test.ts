import { describe, expect, it } from "vitest";

import { hashPassword, hashPasswordAsync, verifyPassword, verifyPasswordAsync } from "./password";

describe("Password Hashing & Verification (scrypt)", () => {
  it("hashes password with salt:hash format", () => {
    const raw = "SuperSecret123!";
    const hash = hashPassword(raw);

    expect(hash).toContain(":");
    const parts = hash.split(":");
    expect(parts).toHaveLength(2);
    // Salt is 32 bytes -> 64 hex characters
    expect(parts[0]).toHaveLength(64);
    // Key is 64 bytes -> 128 hex characters
    expect(parts[1]).toHaveLength(128);
  });

  it("produces different hashes for the same password due to random salt", () => {
    const raw = "SuperSecret123!";
    const hash1 = hashPassword(raw);
    const hash2 = hashPassword(raw);

    expect(hash1).not.toBe(hash2);
  });

  it("verifies correct password against hash", () => {
    const raw = "CorrectPassword@2026";
    const hash = hashPassword(raw);

    expect(verifyPassword(raw, hash)).toBe(true);
  });

  it("keeps async scrypt compatible with existing stored hash format", async () => {
    const raw = "CorrectPassword@2026";
    const hash = hashPassword(raw);

    expect(await verifyPasswordAsync(raw, hash)).toBe(true);
    expect(await verifyPasswordAsync("WrongPassword@2026", hash)).toBe(false);

    const asyncHash = await hashPasswordAsync(raw);
    expect(verifyPassword(raw, asyncHash)).toBe(true);
  });

  it("rejects wrong password", () => {
    const raw = "CorrectPassword@2026";
    const hash = hashPassword(raw);

    expect(verifyPassword("WrongPassword@2026", hash)).toBe(false);
  });

  it("rejects malformed hash string gracefully", () => {
    expect(verifyPassword("password", "invalidhashformat")).toBe(false);
    expect(verifyPassword("password", "")).toBe(false);
    expect(verifyPassword("password", "short:hash")).toBe(false);
  });
});
