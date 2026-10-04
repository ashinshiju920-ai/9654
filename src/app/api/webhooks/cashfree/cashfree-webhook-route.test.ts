import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/commerce/service", () => ({
  processCashfreeWebhook: vi.fn(),
}));

import { processCashfreeWebhook } from "@/lib/commerce/service";

import { POST } from "./route";

describe("Cashfree webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the exact raw body and Cashfree signature headers to the processor", async () => {
    const rawBody = '{"type":"PAYMENT_SUCCESS_WEBHOOK","data":{"order":{"order_id":"aylem_1"}}}';
    vi.mocked(processCashfreeWebhook).mockResolvedValue({
      ok: true,
      processed: true,
      status: "SUCCESS",
      entitlementGranted: true,
      entitlementCreated: true,
    });

    const res = await POST(
      new Request("http://localhost/api/webhooks/cashfree", {
        method: "POST",
        headers: {
          "x-webhook-signature": "signature",
          "x-webhook-timestamp": "123",
        },
        body: rawBody,
      }),
    );

    expect(res.status).toBe(200);
    expect(processCashfreeWebhook).toHaveBeenCalledWith({
      rawBody,
      signature: "signature",
      timestamp: "123",
    });
  });

  it("rejects missing signatures through the processor result", async () => {
    vi.mocked(processCashfreeWebhook).mockResolvedValue({
      ok: false,
      status: 400,
      error: "Missing Cashfree webhook signature.",
    });

    const res = await POST(
      new Request("http://localhost/api/webhooks/cashfree", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("rejects invalid signatures through the processor result", async () => {
    vi.mocked(processCashfreeWebhook).mockResolvedValue({
      ok: false,
      status: 401,
      error: "Invalid Cashfree webhook signature.",
    });

    const res = await POST(
      new Request("http://localhost/api/webhooks/cashfree", {
        method: "POST",
        headers: {
          "x-webhook-signature": "bad",
          "x-webhook-timestamp": "123",
        },
        body: "{}",
      }),
    );

    expect(res.status).toBe(401);
  });
});
