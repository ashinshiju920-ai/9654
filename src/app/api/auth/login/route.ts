import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  checkLoginRateLimit,
  createSession,
  verifyPassword,
} from "@/lib/auth";

export async function POST(request: Request) {
  // Extract client IP for rate limiting.
  // In production, Nginx must set `X-Real-IP` from `$remote_addr` and port 3000
  // must remain private. Do not trust client-supplied forwarding chains here.
  const realIp = request.headers.get("x-real-ip");
  const ip = realIp?.trim() || "direct-local";

  if (!checkLoginRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again in 15 minutes." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { email, password } = body as { email?: string; password?: string };

  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  const userList = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (userList.length === 0) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  const user = userList[0];

  if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  if (user.accountStatus !== "active") {
    return NextResponse.json(
      { error: "Your account is not active. Please contact support." },
      { status: 403 },
    );
  }

  // Create session (sets HTTP-only cookie automatically)
  await createSession(user.id);

  // Touch updated timestamp
  void db
    .update(users)
    .set({ updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .execute();

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  });
}
