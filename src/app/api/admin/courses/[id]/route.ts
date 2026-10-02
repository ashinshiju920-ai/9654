import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireAdminApi } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { isUuid } from "@/lib/materials";
import { logAdminAudit } from "@/lib/admin/audit";

type CourseRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, props: CourseRouteProps) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { id } = await props.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid course ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const { name, displayOrder, isActive } = body as {
    name?: string;
    displayOrder?: number;
    isActive?: boolean;
  };

  const updates: Record<string, unknown> = {};

  if (typeof name === "string" && name.trim()) {
    updates.name = name.trim();
  }
  if (typeof displayOrder === "number" && displayOrder > 0) {
    updates.displayOrder = displayOrder;
  }
  if (typeof isActive === "boolean") {
    updates.isActive = isActive;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  try {
    const [updated] = await withDb((db) =>
      db
        .update(courses)
        .set(updates)
        .where(eq(courses.id, id))
        .returning(),
    );

    if (!updated) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    await logAdminAudit({
      adminUserId: auth.user.id,
      action: "course.update",
      targetType: "course",
      targetId: id,
      details: `Updated course ${updated.slug}: ${JSON.stringify(updates)}`,
    });

    return NextResponse.json({ success: true, course: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update course." },
      { status: 500 },
    );
  }
}
