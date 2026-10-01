import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";

export async function GET() {
  const current = await getCurrentSession();

  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    user: current.user,
  });
}
