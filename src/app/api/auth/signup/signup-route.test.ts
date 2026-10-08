import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  withDb: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  createSession: vi.fn(async () => "session-token"),
  hashPasswordAsync: vi.fn(async () => "hashed-password"),
}));

vi.mock("@/lib/auth/account-lifecycle-service", () => ({
  requestEmailVerification: vi.fn(async () => ({ status: "sent" })),
}));

import { createSession, hashPasswordAsync } from "@/lib/auth";
import { requestEmailVerification } from "@/lib/auth/account-lifecycle-service";
import { withDb } from "@/lib/db";

describe("signup route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOW_PUBLIC_SIGNUP = "false";
  });

  it("allows public account creation regardless of ALLOW_PUBLIC_SIGNUP", async () => {
    const createdUser = {
      id: "user-1",
      email: "new.student@example.com",
      fullName: "New Student",
      role: "student",
    };

    vi.mocked(withDb)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([createdUser]);

    const { POST } = await import("./route");
    const response = await POST(
      jsonRequest("/api/auth/signup", {
        email: " New.Student@Example.com ",
        password: "StrongPassword123!",
        fullName: " New Student ",
      }),
    );
    const body = (await response.json()) as { success: boolean; user: typeof createdUser };

    expect(response.status).toBe(201);
    expect(body).toEqual({ success: true, user: createdUser });
    expect(hashPasswordAsync).toHaveBeenCalledWith("StrongPassword123!");
    expect(createSession).toHaveBeenCalledWith(createdUser.id);
    expect(requestEmailVerification).toHaveBeenCalledWith({
      userId: createdUser.id,
      requestBaseUrl: "https://preview.example/api/auth/signup",
      next: "/dashboard",
    });
  });
});

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`https://preview.example${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
