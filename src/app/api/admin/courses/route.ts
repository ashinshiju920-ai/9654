import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth";
import { getAdminCourses } from "@/lib/admin/queries";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    const list = await getAdminCourses();
    return NextResponse.json({ courses: list });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load courses." },
      { status: 500 },
    );
  }
}
