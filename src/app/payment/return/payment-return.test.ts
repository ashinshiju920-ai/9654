import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireUserOrRedirect: vi.fn(),
}));

vi.mock("@/lib/commerce/service", () => ({
  formatMoneyMinor: vi.fn((amountMinor: number, currency: string) => `₹${amountMinor / 100}`),
  verifyAndSyncCashfreeOrder: vi.fn(),
}));

// Mock next/navigation redirect
const redirectMock = vi.fn((url: string) => {
  const err = new Error(`NEXT_REDIRECT:${url}`);
  (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;${url}`;
  throw err;
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

import { requireUserOrRedirect } from "@/lib/auth";
import { verifyAndSyncCashfreeOrder } from "@/lib/commerce/service";
import PaymentReturnPage from "./page";

const testStudent = {
  id: "student-1",
  email: "student@example.com",
  fullName: "Student One",
  role: "student",
  accountStatus: "active",
};

describe("PaymentReturnPage flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUserOrRedirect).mockResolvedValue(testStudent);
  });

  it("strictly redirects to advanced mocks ONLY when payment is verified as PAID", async () => {
    vi.mocked(verifyAndSyncCashfreeOrder).mockResolvedValue({
      id: "ord-1",
      userId: "student-1",
      userEmail: "student@example.com",
      productId: "prod-1",
      productSlug: "ielts-advanced",
      productName: "IELTS Advanced",
      courseSlug: "ielts",
      courseName: "IELTS",
      accessTier: "ADVANCED",
      amountMinor: 29900,
      currency: "INR",
      status: "PAID",
      provider: "CASHFREE",
      providerEnvironment: "SANDBOX",
      providerOrderId: "aylem_test_123",
      providerOrderStatus: "PAID",
      failureReason: null,
      paidAt: new Date(),
      cancelledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      PaymentReturnPage({
        searchParams: Promise.resolve({ order_id: "aylem_test_123" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/advanced-mock-test?course=ielts&payment=success");

    expect(redirectMock).toHaveBeenCalledWith(
      "/advanced-mock-test?course=ielts&payment=success",
    );
  });

  it("does NOT redirect to advanced mocks when payment is FAILED or CANCELLED", async () => {
    vi.mocked(verifyAndSyncCashfreeOrder).mockResolvedValue({
      id: "ord-2",
      userId: "student-1",
      userEmail: "student@example.com",
      productId: "prod-1",
      productSlug: "ielts-advanced",
      productName: "IELTS Advanced",
      courseSlug: "ielts",
      courseName: "IELTS",
      accessTier: "ADVANCED",
      amountMinor: 29900,
      currency: "INR",
      status: "FAILED",
      provider: "CASHFREE",
      providerEnvironment: "SANDBOX",
      providerOrderId: "aylem_failed_123",
      providerOrderStatus: "FAILED",
      failureReason: "Insufficient funds",
      paidAt: null,
      cancelledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const jsx = await PaymentReturnPage({
      searchParams: Promise.resolve({ order_id: "aylem_failed_123" }),
    });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(jsx).toBeDefined();
  });

  it("does NOT redirect to advanced mocks when payment is still PENDING", async () => {
    vi.mocked(verifyAndSyncCashfreeOrder).mockResolvedValue({
      id: "ord-3",
      userId: "student-1",
      userEmail: "student@example.com",
      productId: "prod-1",
      productSlug: "ielts-advanced",
      productName: "IELTS Advanced",
      courseSlug: "ielts",
      courseName: "IELTS",
      accessTier: "ADVANCED",
      amountMinor: 29900,
      currency: "INR",
      status: "PENDING",
      provider: "CASHFREE",
      providerEnvironment: "SANDBOX",
      providerOrderId: "aylem_pending_123",
      providerOrderStatus: "PENDING",
      failureReason: null,
      paidAt: null,
      cancelledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const jsx = await PaymentReturnPage({
      searchParams: Promise.resolve({ order_id: "aylem_pending_123" }),
    });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(jsx).toBeDefined();
  });

  it("does NOT redirect when order_id is missing", async () => {
    const jsx = await PaymentReturnPage({
      searchParams: Promise.resolve({}),
    });

    expect(verifyAndSyncCashfreeOrder).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(jsx).toBeDefined();
  });
});
