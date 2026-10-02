import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth";
import { getRecentAuditLogs } from "@/lib/admin/audit";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50));

  try {
    const logs = await getRecentAuditLogs(limit);
    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load audit logs." },
      { status: 500 },
    );
  }
}
