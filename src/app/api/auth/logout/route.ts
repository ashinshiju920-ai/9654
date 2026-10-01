import { NextResponse } from "next/server";
import { cookies } from "next/headers";

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
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  return NextResponse.json({ success: true });
}
