import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/main-site-bridge", () => ({
  processMainSitePurchase: vi.fn(),
}));

import { processMainSitePurchase } from "@/lib/integrations/main-site-bridge";
import { POST } from "./route";

describe("Main Site Purchase Bridge Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects public / browser request missing signature headers with 401", async () => {
    const res = await POST(
      new Request("https://portal.aylemlearning.online/api/integrations/main-site/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: "main_123",
          customerEmail: "student@example.com",
          courseSlug: "ielts",
          paymentStatus: "PAID",
        }),
      }),
    );

    expect(res.status).toBe(401);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toContain("Missing authentication headers");
    expect(processMainSitePurchase).not.toHaveBeenCalled();
  });

  it("passes raw body, signature, and timestamp to the bridge processor", async () => {
    const rawBody = JSON.stringify({
      orderId: "main_ord_999",
      customerEmail: "student@example.com",
      courseSlug: "ielts",
      paymentStatus: "PAID",
    });

    vi.mocked(processMainSitePurchase).mockResolvedValue({
      success: true,
      orderId: "main_ord_999",
      externalReference: "main-site:main_ord_999:main-product-ielts:ielts:STANDARD",
      email: "student@example.com",
      courseSlug: "ielts",
      accessTier: "STANDARD",
      isNewStudent: true,
      emailSent: true,
    });

    const res = await POST(
      new Request("https://portal.aylemlearning.online/api/integrations/main-site/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-aylem-signature": "test-signature-hex",
          "x-aylem-timestamp": "1791054000000",
        },
        body: rawBody,
      }),
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { success?: boolean; orderId?: string };
    expect(data.success).toBe(true);
    expect(data.orderId).toBe("main_ord_999");
    expect(processMainSitePurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        rawBody,
        signature: "test-signature-hex",
        timestamp: "1791054000000",
      }),
    );
  });

  it("supports alternative header names (e.g. x-integration-signature)", async () => {
    const rawBody = JSON.stringify({ orderId: "ord_1" });
    vi.mocked(processMainSitePurchase).mockResolvedValue({
      success: true,
      orderId: "ord_1",
      externalReference: "main-site:ord_1:main-product-oet:oet:ADVANCED",
      email: "test@aylem.com",
      courseSlug: "oet",
      accessTier: "ADVANCED",
      isNewStudent: false,
    });

    const res = await POST(
      new Request("https://portal.aylemlearning.online/api/integrations/main-site/purchase", {
        method: "POST",
        headers: {
          "x-integration-signature": "alt-sig",
          "x-integration-timestamp": "1791054000000",
        },
        body: rawBody,
      }),
    );

    expect(res.status).toBe(200);
    expect(processMainSitePurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        signature: "alt-sig",
        timestamp: "1791054000000",
      }),
    );
  });

  it("supports the Step 13B sender header names", async () => {
    const rawBody = JSON.stringify({
      orderId: "order123:ielts",
      customerEmail: "student@example.com",
      courseSlug: "ielts",
      paymentStatus: "PAID",
    });
    vi.mocked(processMainSitePurchase).mockResolvedValue({
      success: true,
      orderId: "order123:ielts",
      externalReference: "main-site:order123:ielts:ielts:STANDARD",
      email: "student@example.com",
      courseSlug: "ielts",
      accessTier: "STANDARD",
      isNewStudent: false,
    });

    const res = await POST(
      new Request("https://portal.aylemlearning.online/api/integrations/main-site/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-signature": "base64-sig",
          "x-webhook-timestamp": "1791054000000",
        },
        body: rawBody,
      }),
    );

    expect(res.status).toBe(200);
    expect(processMainSitePurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        rawBody,
        signature: "base64-sig",
        timestamp: "1791054000000",
      }),
    );
  });

  it("returns error status and message when bridge processor fails", async () => {
    vi.mocked(processMainSitePurchase).mockResolvedValue({
      success: false,
      status: 400,
      error: "Only PAID orders can be provisioned.",
    });

    const res = await POST(
      new Request("https://portal.aylemlearning.online/api/integrations/main-site/purchase", {
        method: "POST",
        headers: {
          "x-signature": "sig",
          "x-timestamp": "123",
        },
        body: JSON.stringify({ orderId: "1", paymentStatus: "PENDING" }),
      }),
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe("Only PAID orders can be provisioned.");
  });
});
