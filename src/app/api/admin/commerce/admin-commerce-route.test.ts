import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireAdminApi: vi.fn(),
}));

vi.mock("@/lib/commerce/service", () => ({
  listAdminCommerce: vi.fn(),
}));

import { requireAdminApi } from "@/lib/auth";
import { listAdminCommerce } from "@/lib/commerce/service";

import { GET } from "./route";

describe("admin commerce route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects ordinary students through admin RBAC", async () => {
    vi.mocked(requireAdminApi).mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const res = await GET();

    expect(res.status).toBe(403);
    expect(listAdminCommerce).not.toHaveBeenCalled();
  });

  it("returns commerce records for admins", async () => {
    vi.mocked(requireAdminApi).mockResolvedValue({
      user: {
        id: "admin-1",
        email: "admin@example.com",
        fullName: "Admin",
        role: "admin",
        accountStatus: "active",
      },
    });
    vi.mocked(listAdminCommerce).mockResolvedValue({ products: [], orders: [], payments: [] });

    const res = await GET();

    expect(res.status).toBe(200);
  });
});
