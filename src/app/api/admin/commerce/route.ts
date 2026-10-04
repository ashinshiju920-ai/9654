import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth";
import { listAdminCommerce } from "@/lib/commerce/service";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  return NextResponse.json(await listAdminCommerce());
}
