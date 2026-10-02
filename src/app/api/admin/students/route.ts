import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth";
import { getAdminStudents } from "@/lib/admin/queries";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10) || 1;
  const limit = parseInt(url.searchParams.get("limit") || "20", 10) || 20;

  try {
    const data = await getAdminStudents({ search, status, page, limit });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load students." },
      { status: 500 },
    );
  }
}
