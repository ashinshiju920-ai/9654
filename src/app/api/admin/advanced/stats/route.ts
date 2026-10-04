import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getAdvancedHealthOverview } from "@/lib/admin/advanced-practice";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    const stats = await getAdvancedHealthOverview();
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Advanced Practice statistics." },
      { status: 500 },
    );
  }
}
