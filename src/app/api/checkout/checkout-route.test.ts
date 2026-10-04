import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  requireUser: vi.fn(),
}));

vi.mock("@/lib/commerce/service", () => ({
  createCheckoutSession: vi.fn(),
  getAppBaseUrl: vi.fn(),
}));

import { AuthenticationError, requireUser } from "@/lib/auth";
import { createCheckoutSession, getAppBaseUrl } from "@/lib/commerce/service";

import { POST } from "./route";

const student = {
  id: "student-1",
  email: "student@example.com",
  fullName: "Student",
  role: "student",
  accountStatus: "active",
};

describe("checkout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAppBaseUrl).mockResolvedValue("http://localhost:3000");
  });

  it("rejects unauthenticated checkout", async () => {
    vi.mocked(requireUser).mockRejectedValue(new AuthenticationError("Authentication required."));

    const res = await POST(
      new Request("http://localhost/api/checkout", {
        method: "POST",
        body: JSON.stringify({ productSlug: "ielts-advanced" }),
      }),
    );

    expect(res.status).toBe(401);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects missing or invalid product identifiers", async () => {
    vi.mocked(requireUser).mockResolvedValue(student);

    const res = await POST(
      new Request("http://localhost/api/checkout", {
        method: "POST",
        body: JSON.stringify({ price: 1, course: "ielts", accessTier: "ADVANCED" }),
      }),
    );

    expect(res.status).toBe(400);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("passes only product identity to the commerce service", async () => {
    vi.mocked(requireUser).mockResolvedValue(student);
    vi.mocked(createCheckoutSession).mockResolvedValue({
      ok: true,
      orderId: "order-1",
      providerOrderId: "aylem_order",
      paymentSessionId: "session-1",
      cashfreeEnvironment: "SANDBOX",
    });

    const res = await POST(
      new Request("http://localhost/api/checkout", {
        method: "POST",
        body: JSON.stringify({
          productSlug: "ielts-advanced",
          price: 1,
          course: "oet",
          accessTier: "STANDARD",
          status: "PAID",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(createCheckoutSession).toHaveBeenCalledWith({
      user: student,
      product: { productSlug: "ielts-advanced", productId: undefined },
      appBaseUrl: "http://localhost:3000",
    });
  });

  it("prevents duplicate owned-product checkout", async () => {
    vi.mocked(requireUser).mockResolvedValue(student);
    vi.mocked(createCheckoutSession).mockResolvedValue({
      ok: false,
      status: 409,
      error: "You already have access.",
    });

    const res = await POST(
      new Request("http://localhost/api/checkout", {
        method: "POST",
        body: JSON.stringify({ productSlug: "ielts-standard" }),
      }),
    );

    expect(res.status).toBe(409);
  });
});
