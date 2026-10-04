import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth";
import { logAdminAudit } from "@/lib/admin/audit";
import {
  accessTiers,
  entitlementSources,
  getEntitlementAdminOptions,
  grantEntitlement,
  isAccessTier,
  isEntitlementSource,
  listEntitlements,
} from "@/lib/entitlements";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || undefined;

  try {
    const [entitlements, options] = await Promise.all([
      listEntitlements({ search }),
      getEntitlementAdminOptions(),
    ]);

    return NextResponse.json({
      entitlements,
      students: options.students,
      courses: options.courses,
      accessTiers,
      sources: entitlementSources,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load entitlements." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const payload = body as {
    userId?: string;
    courseId?: string;
    accessTier?: string;
    source?: string;
    expiresAt?: string | null;
    externalReference?: string | null;
  };

  const accessTier = (payload.accessTier || "").trim().toUpperCase();
  const source = (payload.source || "ADMIN").trim().toUpperCase();

  if (!payload.userId || !payload.courseId) {
    return NextResponse.json({ error: "Student and course are required." }, { status: 400 });
  }
  if (!isAccessTier(accessTier)) {
    return NextResponse.json({ error: "Invalid access tier." }, { status: 400 });
  }
  if (!isEntitlementSource(source) || source !== "ADMIN") {
    return NextResponse.json({ error: "Manual grants must use ADMIN source." }, { status: 400 });
  }

  let expiresAt: Date | null = null;
  if (payload.expiresAt) {
    expiresAt = new Date(payload.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      return NextResponse.json({ error: "Invalid expiry date." }, { status: 400 });
    }
  }

  try {
    const result = await grantEntitlement({
      userId: payload.userId,
      courseId: payload.courseId,
      accessTier,
      source,
      expiresAt,
      externalReference: payload.externalReference?.trim() || null,
    });

    await logAdminAudit({
      adminUserId: auth.user.id,
      action: result.created ? "entitlement.grant" : "entitlement.grant_idempotent_update",
      targetType: "course_entitlement",
      targetId: result.entitlement.id,
      details: `Granted ${accessTier} course entitlement via ${source}`,
    });

    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to grant entitlement." },
      { status: 400 },
    );
  }
}
