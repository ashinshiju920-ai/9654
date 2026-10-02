import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth";
import { getAdminStats } from "@/lib/admin/queries";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    const stats = await getAdminStats();
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load admin stats." },
      { status: 500 },
    );
  }
}
