import { NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";

import { invalidateAllUserSessions, requireAdminApi } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { commerceOrders, commercePayments, users } from "@/lib/db/schema";
import { isUuid } from "@/lib/materials";
import { logAdminAudit } from "@/lib/admin/audit";

const VALID_STATUSES = new Set(["active", "suspended", "pending"]);
const VALID_ROLES = new Set(["student", "admin"]);
const OWNER_EMAIL = "ashinshiju920@gmail.com";

type StudentRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, props: StudentRouteProps) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { id } = await props.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
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

  const { accountStatus, role } = body as {
    accountStatus?: string;
    role?: string;
  };

  if (!accountStatus && !role) {
    return NextResponse.json({ error: "No fields provided to update." }, { status: 400 });
  }

  return withDb(async (db) => {
    // 1. Fetch target user
    const [targetUser] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        accountStatus: users.accountStatus,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // 2. Validate account status change
    if (accountStatus) {
      if (!VALID_STATUSES.has(accountStatus)) {
        return NextResponse.json(
          { error: "Invalid account status. Choose active, suspended, or pending." },
          { status: 400 },
        );
      }

      if (accountStatus !== "active" && targetUser.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
        return NextResponse.json(
          { error: "Action blocked: The permanent owner account cannot be suspended." },
          { status: 400 },
        );
      }

      if (accountStatus !== "active" && targetUser.role === "admin") {
        const [adminCountRow] = await db
          .select({ count: count(users.id) })
          .from(users)
          .where(and(eq(users.role, "admin"), eq(users.accountStatus, "active")));

        if (Number(adminCountRow?.count || 0) <= 1) {
          return NextResponse.json(
            { error: "Action blocked: Cannot suspend the only remaining active admin." },
            { status: 400 },
          );
        }
      }

      updates.accountStatus = accountStatus;
    }

    // 3. Validate role change
    if (role) {
      if (!VALID_ROLES.has(role)) {
        return NextResponse.json({ error: "Invalid role. Choose student or admin." }, { status: 400 });
      }

      if (role === "student" && targetUser.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
        return NextResponse.json(
          { error: "Action blocked: The permanent owner account cannot be demoted." },
          { status: 400 },
        );
      }

      if (role === "student" && targetUser.role === "admin") {
        const [adminCountRow] = await db
          .select({ count: count(users.id) })
          .from(users)
          .where(and(eq(users.role, "admin"), eq(users.accountStatus, "active")));

        if (Number(adminCountRow?.count || 0) <= 1) {
          return NextResponse.json(
            { error: "Action blocked: Cannot demote the only remaining active admin." },
            { status: 400 },
          );
        }
      }

      updates.role = role;
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        accountStatus: users.accountStatus,
        emailVerified: users.emailVerified,
        updatedAt: users.updatedAt,
      });

    // If account was suspended or demoted, revoke all active sessions
    if (accountStatus === "suspended" || role === "student") {
      await invalidateAllUserSessions(targetUser.id);
    }

    await logAdminAudit({
      adminUserId: auth.user.id,
      action: accountStatus ? (accountStatus === "active" ? "student.activate" : "student.suspend") : "student.role_change",
      targetType: "student",
      targetId: id,
      details: `Updated ${targetUser.email}: ${JSON.stringify(updates)}`,
    });

    return NextResponse.json({
      success: true,
      student: {
        ...updated,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  });
}

export async function DELETE(_request: Request, props: StudentRouteProps) {
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
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        accountStatus: users.accountStatus,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (targetUser.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
      return NextResponse.json(
        { error: "Action blocked: The permanent owner account cannot be removed." },
        { status: 400 },
      );
    }

    if (targetUser.id === auth.user.id) {
      return NextResponse.json(
        { error: "Action blocked: You cannot remove your own signed-in admin account." },
        { status: 400 },
      );
    }

    if (targetUser.role === "admin" && targetUser.accountStatus === "active") {
      const [adminCountRow] = await db
        .select({ count: count(users.id) })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.accountStatus, "active")));

      if (Number(adminCountRow?.count || 0) <= 1) {
        return NextResponse.json(
          { error: "Action blocked: Cannot remove the only remaining active admin." },
          { status: 400 },
        );
      }
    }

    await db.delete(commercePayments).where(eq(commercePayments.userId, id));
    await db.delete(commerceOrders).where(eq(commerceOrders.userId, id));
    await db.delete(users).where(eq(users.id, id));

    await logAdminAudit({
      adminUserId: auth.user.id,
      action: "student.delete",
      targetType: "student",
      targetId: id,
      details: `Deleted user account ${targetUser.email}`,
    });

    return NextResponse.json({
      success: true,
      message: `${targetUser.email} has been removed.`,
    });
  });
}
