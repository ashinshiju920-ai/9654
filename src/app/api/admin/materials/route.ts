import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth";
import { getAdminMaterials } from "@/lib/admin/queries";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const url = new URL(request.url);
  const courseSlug = url.searchParams.get("course") || undefined;

  try {
    const materials = await getAdminMaterials(courseSlug);
    return NextResponse.json({ materials });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load materials." },
      { status: 500 },
    );
  }
}
