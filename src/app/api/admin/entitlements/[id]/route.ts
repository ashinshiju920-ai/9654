import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth";
import { logAdminAudit } from "@/lib/admin/audit";
import { revokeEntitlement } from "@/lib/entitlements";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const action = body && typeof body === "object" ? (body as { action?: string }).action : undefined;
  if (action && action !== "revoke") {
    return NextResponse.json({ error: "Unsupported entitlement action." }, { status: 400 });
  }

  const { id } = await params;

  try {
    const entitlement = await revokeEntitlement(id);
    await logAdminAudit({
      adminUserId: auth.user.id,
      action: "entitlement.revoke",
      targetType: "course_entitlement",
      targetId: id,
      details: "Revoked course entitlement",
    });
    return NextResponse.json(entitlement);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to revoke entitlement." },
      { status: 400 },
    );
  }
}
