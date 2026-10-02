import "server-only";

import { withDb } from "@/lib/db";
import { sql } from "drizzle-orm";

export type AdminAuditAction =
  | "course.update"
  | "course.create"
  | "material.upload"
  | "material.publish"
  | "material.unpublish"
  | "material.update"
  | "material.delete"
  | "question.create"
  | "question.update"
  | "question.delete"
  | "question.bulk_import"
  | "student.activate"
  | "student.suspend"
  | "student.role_change"
  | "student.revoke_sessions";

export type AdminAuditEntry = {
  adminUserId: string;
  action: AdminAuditAction;
  targetType: "course" | "material" | "question" | "student" | "system";
  targetId?: string | null;
  details?: string | null;
};

/**
 * Log an administrative mutation for compliance and tracking.
 * Safe against missing tables or transient DB issues.
 */
export async function logAdminAudit(entry: AdminAuditEntry): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(
    `[ADMIN AUDIT] [${timestamp}] admin=${entry.adminUserId} action=${entry.action} target=${entry.targetType}:${entry.targetId || "n/a"} details=${entry.details || ""}`,
  );

  try {
    await withDb(async (db) => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS admin_audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          action VARCHAR(64) NOT NULL,
          target_type VARCHAR(64) NOT NULL,
          target_id VARCHAR(128),
          details TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await db.execute(sql`
        INSERT INTO admin_audit_logs (admin_user_id, action, target_type, target_id, details)
        VALUES (${entry.adminUserId}, ${entry.action}, ${entry.targetType}, ${entry.targetId || null}, ${entry.details || null});
      `);
    });
  } catch {
    // If table creation or insert fails, fallback to structured console log
  }
}

export type RecentAuditLog = {
  id: string;
  adminEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  details: string | null;
  createdAt: string;
};

export async function getRecentAuditLogs(limit = 20): Promise<RecentAuditLog[]> {
  try {
    const rows = await withDb(async (db) => {
      const result = await db.execute(sql`
        SELECT a.id, u.email as admin_email, a.action, a.target_type, a.target_id, a.details, a.created_at
        FROM admin_audit_logs a
        LEFT JOIN users u ON a.admin_user_id = u.id
        ORDER BY a.created_at DESC
        LIMIT ${limit};
      `);
      return result.rows as Array<{
        id: string;
        admin_email: string | null;
        action: string;
        target_type: string;
        target_id: string | null;
        details: string | null;
        created_at: Date;
      }>;
    });

    return rows.map((r) => ({
      id: r.id,
      adminEmail: r.admin_email,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      details: r.details,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  } catch {
    return [];
  }
}
