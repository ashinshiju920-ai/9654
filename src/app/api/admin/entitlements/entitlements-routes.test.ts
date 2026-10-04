import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAdminApi: vi.fn(),
}));

vi.mock("@/lib/admin/audit", () => ({
  logAdminAudit: vi.fn(async () => undefined),
}));

vi.mock("@/lib/entitlements", async () => {
  const actual = await vi.importActual<typeof import("@/lib/entitlements")>("@/lib/entitlements");
  return {
    ...actual,
    getEntitlementAdminOptions: vi.fn(),
    grantEntitlement: vi.fn(),
    listEntitlements: vi.fn(),
    revokeEntitlement: vi.fn(),
  };
});

import { requireAdminApi } from "@/lib/auth";
import {
  getEntitlementAdminOptions,
  grantEntitlement,
  listEntitlements,
  revokeEntitlement,
} from "@/lib/entitlements";
import { POST, GET } from "./route";
import { PATCH } from "./[id]/route";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  role: "admin",
  accountStatus: "active",
};

describe("Admin entitlement routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdminApi).mockResolvedValue({ user: adminUser });
  });

  it("blocks non-admin access via requireAdminApi", async () => {
    const forbidden = Response.json({ error: "Forbidden" }, { status: 403 });
    vi.mocked(requireAdminApi).mockResolvedValue({ errorResponse: forbidden } as never);

    const res = await GET(new Request("http://localhost/api/admin/entitlements"));
    expect(res.status).toBe(403);
  });

  it("lists entitlements with admin options", async () => {
    vi.mocked(listEntitlements).mockResolvedValue([]);
    vi.mocked(getEntitlementAdminOptions).mockResolvedValue({ students: [], courses: [] });

    const res = await GET(new Request("http://localhost/api/admin/entitlements"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { accessTiers: string[] };
    expect(data.accessTiers).toContain("STANDARD");
    expect(data.accessTiers).toContain("ADVANCED");
  });

  it("admin can grant entitlement", async () => {
    vi.mocked(grantEntitlement).mockResolvedValue({
      created: true,
      entitlement: { id: "ent-1" },
    } as never);

    const res = await POST(
      new Request("http://localhost/api/admin/entitlements", {
        method: "POST",
        body: JSON.stringify({
          userId: "user-1",
          courseId: "course-1",
          accessTier: "ADVANCED",
          source: "ADMIN",
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(grantEntitlement).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        courseId: "course-1",
        accessTier: "ADVANCED",
        source: "ADMIN",
      }),
    );
  });

  it("duplicate grant is handled idempotently", async () => {
    vi.mocked(grantEntitlement).mockResolvedValue({
      created: false,
      entitlement: { id: "ent-1" },
    } as never);

    const res = await POST(
      new Request("http://localhost/api/admin/entitlements", {
        method: "POST",
        body: JSON.stringify({
          userId: "user-1",
          courseId: "course-1",
          accessTier: "STANDARD",
          source: "ADMIN",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { created: boolean };
    expect(data.created).toBe(false);
  });

  it("rejects invalid tier combinations", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/entitlements", {
        method: "POST",
        body: JSON.stringify({
          userId: "user-1",
          courseId: "course-1",
          accessTier: "PREMIUM",
          source: "ADMIN",
        }),
      }),
    );

    expect(res.status).toBe(400);
    expect(grantEntitlement).not.toHaveBeenCalled();
  });

  it("admin can revoke entitlement", async () => {
    vi.mocked(revokeEntitlement).mockResolvedValue({ id: "ent-1", status: "REVOKED" } as never);

    const res = await PATCH(
      new Request("http://localhost/api/admin/entitlements/ent-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "revoke" }),
      }),
      { params: Promise.resolve({ id: "11111111-1111-4111-a111-111111111111" }) },
    );

    expect(res.status).toBe(200);
    expect(revokeEntitlement).toHaveBeenCalled();
  });
});
