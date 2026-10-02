import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireAdminApi } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { coursePdfs } from "@/lib/db/schema";
import { isUuid } from "@/lib/materials";
import { deletePdfFromR2 } from "@/lib/r2/client";
import { logAdminAudit } from "@/lib/admin/audit";

type MaterialRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, props: MaterialRouteProps) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { id } = await props.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid material ID." }, { status: 400 });
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

  const { title, description, isPublished, displayOrder } = body as {
    title?: string;
    description?: string | null;
    isPublished?: boolean;
    displayOrder?: number;
  };

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (typeof title === "string" && title.trim()) {
    updates.title = title.trim();
  }
  if (description !== undefined) {
    updates.description = description ? description.trim() : null;
  }
  if (typeof isPublished === "boolean") {
    updates.isPublished = isPublished;
  }
  if (typeof displayOrder === "number") {
    updates.displayOrder = displayOrder;
  }

  try {
    const [updated] = await withDb((db) =>
      db
        .update(coursePdfs)
        .set(updates)
        .where(eq(coursePdfs.id, id))
        .returning(),
    );

    if (!updated) {
      return NextResponse.json({ error: "Material not found." }, { status: 404 });
    }

    const auditAction =
      isPublished !== undefined
        ? isPublished
          ? "material.publish"
          : "material.unpublish"
        : "material.update";

    await logAdminAudit({
      adminUserId: auth.user.id,
      action: auditAction,
      targetType: "material",
      targetId: id,
      details: `Updated '${updated.title}': ${JSON.stringify(updates)}`,
    });

    return NextResponse.json({
      success: true,
      material: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update material." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, props: MaterialRouteProps) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { id } = await props.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid material ID." }, { status: 400 });
  }

  try {
    const [deleted] = await withDb((db) =>
      db
        .delete(coursePdfs)
        .where(eq(coursePdfs.id, id))
        .returning({
          id: coursePdfs.id,
          title: coursePdfs.title,
          r2ObjectKey: coursePdfs.r2ObjectKey,
        }),
    );

    if (!deleted) {
      return NextResponse.json({ error: "Material not found." }, { status: 404 });
    }

    // Clean up file in Cloudflare R2
    try {
      await deletePdfFromR2(deleted.r2ObjectKey);
    } catch (r2Error) {
      console.error(`Failed to delete R2 object ${deleted.r2ObjectKey}:`, r2Error);
    }

    await logAdminAudit({
      adminUserId: auth.user.id,
      action: "material.delete",
      targetType: "material",
      targetId: id,
      details: `Deleted material '${deleted.title}' and cleaned up R2 object: ${deleted.r2ObjectKey}`,
    });

    return NextResponse.json({ success: true, message: "Material and R2 file deleted successfully." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete material." },
      { status: 500 },
    );
  }
}
