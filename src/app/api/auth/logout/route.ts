import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { isProductionRuntime } from "@/lib/cloudflare/runtime";
import { getCurrentSession, invalidateSession, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const current = await getCurrentSession();

  if (current) {
    await invalidateSession(current.session.id);
  } else {
    // Clear cookie even if session was expired or not found
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: await isProductionRuntime(),
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  return NextResponse.json({ success: true });
}
