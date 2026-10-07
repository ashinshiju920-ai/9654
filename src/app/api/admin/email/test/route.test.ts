import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAdminApi: vi.fn(),
}));

vi.mock("@/lib/email/resend", () => ({
  getResendStatus: vi.fn(),
  sendTransactionalEmail: vi.fn(),
}));

import { requireAdminApi } from "@/lib/auth";
import { getResendStatus, sendTransactionalEmail } from "@/lib/email/resend";
import { GET, POST } from "./route";

describe("admin email test route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks non-admin users from accessing GET", async () => {
    vi.mocked(requireAdminApi).mockResolvedValue({
      session: null,
      errorResponse: new Response("Unauthorized", { status: 401 }),
    } as unknown as Awaited<ReturnType<typeof requireAdminApi>>);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns email configuration status for admins", async () => {
    vi.mocked(requireAdminApi).mockResolvedValue({
      session: { user: { role: "ADMIN" } },
      errorResponse: null,
    } as unknown as Awaited<ReturnType<typeof requireAdminApi>>);

    vi.mocked(getResendStatus).mockResolvedValue({
      configured: true,
      hasApiKey: true,
      fromEmail: "Aylem Learning <onboarding@resend.dev>",
    });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.configured).toBe(true);
    expect(json.isSandboxFrom).toBe(true);
  });

  it("sends a test email successfully via POST", async () => {
    vi.mocked(requireAdminApi).mockResolvedValue({
      session: { user: { role: "ADMIN" } },
      errorResponse: null,
    } as unknown as Awaited<ReturnType<typeof requireAdminApi>>);

    vi.mocked(sendTransactionalEmail).mockResolvedValue({
      status: "sent",
      id: "resend_msg_123",
    });

    const req = new Request("http://localhost/api/admin/email/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: "admin@test.com" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.id).toBe("resend_msg_123");
  });

  it("handles Resend API rejection in POST gracefully", async () => {
    vi.mocked(requireAdminApi).mockResolvedValue({
      session: { user: { role: "ADMIN" } },
      errorResponse: null,
    } as unknown as Awaited<ReturnType<typeof requireAdminApi>>);

    vi.mocked(sendTransactionalEmail).mockRejectedValue(
      new Error("Resend API error (403 validation_error): You can only send testing emails to your own email address."),
    );

    const req = new Request("http://localhost/api/admin/email/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: "student@other.com" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain("403 validation_error");
  });
});
