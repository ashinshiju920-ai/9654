import { describe, expect, it, vi } from "vitest";

import {
  AuthenticationError,
  checkLoginRateLimit,
  hashPassword,
  RATE_LIMIT_MAX_ATTEMPTS,
  requireAdmin,
  requireUser,
  verifyPassword,
} from "./index";
import { getCurrentSession } from "./session";
import type { SessionUser } from "./session";

// Mock the session module to test authorization guards under different account conditions
vi.mock("./session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./session")>();
  return {
    ...actual,
    getCurrentSession: vi.fn(),
  };
});

describe("Complete Authenticated Journey & Security Constraints", () => {
  const mockedGetCurrentSession = vi.mocked(getCurrentSession);

  it("authenticates active student successfully", async () => {
    const studentUser: SessionUser = {
      id: "student-uuid-1",
      email: "student@aylem.test",
      fullName: "Active Student",
      role: "student",
      accountStatus: "active",
    };

    mockedGetCurrentSession.mockResolvedValueOnce({
      session: { id: "sess-1", expiresAt: new Date(Date.now() + 100000) },
      user: studentUser,
    });

    const user = await requireUser();
    expect(user.id).toBe("student-uuid-1");
    expect(user.role).toBe("student");
  });

  it("denies access when session is missing or expired", async () => {
    mockedGetCurrentSession.mockResolvedValueOnce(null);

    await expect(requireUser()).rejects.toThrow(AuthenticationError);
    await expect(requireUser()).rejects.toThrow("You must be logged in to access this resource.");
  });

  it("denies access if account is suspended/disabled", async () => {
    // When accountStatus is not 'active', getCurrentSession returns null
    mockedGetCurrentSession.mockResolvedValueOnce(null);

    await expect(requireUser()).rejects.toThrow(AuthenticationError);
  });

  it("blocks student from accessing admin-only resources", async () => {
    const studentUser: SessionUser = {
      id: "student-uuid-1",
      email: "student@aylem.test",
      fullName: "Active Student",
      role: "student",
      accountStatus: "active",
    };

    mockedGetCurrentSession.mockResolvedValueOnce({
      session: { id: "sess-1", expiresAt: new Date(Date.now() + 100000) },
      user: studentUser,
    });

    await expect(requireAdmin()).rejects.toThrow("You do not have permission to access this resource.");
  });

  it("allows admin user to access admin resources", async () => {
    const adminUser: SessionUser = {
      id: "admin-uuid-1",
      email: "admin@aylem.test",
      fullName: "Admin User",
      role: "admin",
      accountStatus: "active",
    };

    mockedGetCurrentSession.mockResolvedValueOnce({
      session: { id: "sess-2", expiresAt: new Date(Date.now() + 100000) },
      user: adminUser,
    });

    const user = await requireAdmin();
    expect(user.role).toBe("admin");
  });

  it("enforces rate limits against brute force attacks", () => {
    const attackerIp = "198.51.100.42";

    for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) {
      expect(checkLoginRateLimit(attackerIp)).toBe(true);
    }

    // 11th attempt must be rejected
    expect(checkLoginRateLimit(attackerIp)).toBe(false);
  });

  it("rejects wrong passwords and invalid hashes securely", () => {
    const password = "CorrectStudentPassword123!";
    const hash = hashPassword(password);

    // Correct password
    expect(verifyPassword(password, hash)).toBe(true);

    // Wrong password
    expect(verifyPassword("WrongStudentPassword123!", hash)).toBe(false);

    // Corrupted hash
    expect(verifyPassword(password, "invalid_hash_value")).toBe(false);
  });
});
