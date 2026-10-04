import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  requireUser: vi.fn(),
}));

vi.mock("@/lib/commerce/service", () => ({
  getOrderForUser: vi.fn(),
}));

import { requireUser } from "@/lib/auth";
import { getOrderForUser } from "@/lib/commerce/service";

import { GET } from "./route";

const student = {
  id: "student-1",
  email: "student@example.com",
  fullName: "Student",
  role: "student",
  accountStatus: "active",
};

describe("order route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes order lookup to the authenticated user", async () => {
    vi.mocked(requireUser).mockResolvedValue(student);
    vi.mocked(getOrderForUser).mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/orders/order-1"), {
      params: Promise.resolve({ id: "order-1" }),
    });

    expect(res.status).toBe(404);
    expect(getOrderForUser).toHaveBeenCalledWith({ user: student, orderId: "order-1" });
  });
});
