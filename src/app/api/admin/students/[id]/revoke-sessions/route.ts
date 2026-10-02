import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { invalidateAllUserSessions, requireAdminApi } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isUuid } from "@/lib/materials";
import { logAdminAudit } from "@/lib/admin/audit";

type StudentRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, props: StudentRouteProps) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { id } = await props.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
  }

  return withDb(async (db) => {
    const [targetUser] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    await invalidateAllUserSessions(targetUser.id);

    await logAdminAudit({
      adminUserId: auth.user.id,
      action: "student.revoke_sessions",
      targetType: "student",
      targetId: id,
      details: `Revoked all active sessions for ${targetUser.email}`,
    });

    return NextResponse.json({
      success: true,
      message: `All sessions for ${targetUser.email} have been revoked.`,
    });
  });
}
