import { NextResponse } from "next/server";

import { AuthenticationError, requireUser } from "@/lib/auth";
import { listPurchasesForUser } from "@/lib/commerce/service";

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Unauthorized: Please log in." }, { status: 401 });
    }
    throw error;
  }

  return NextResponse.json({ purchases: await listPurchasesForUser(user) });
}
