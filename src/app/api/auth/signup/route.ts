import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getRuntimeEnvValue } from "@/lib/cloudflare/runtime";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession, hashPasswordAsync } from "@/lib/auth";

export async function POST(request: Request) {
  if ((await getRuntimeEnvValue("ALLOW_PUBLIC_SIGNUP")) !== "true") {
    return NextResponse.json(
      {
        error:
          "Public registration is currently disabled. Student accounts are provisioned upon enrollment.",
      },
      { status: 403 },
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

  const { email, password, fullName } = body as {
    email?: string;
    password?: string;
    fullName?: string;
  };

  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const db = await getDb();

  // Basic email pattern check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters long." },
      { status: 400 },
    );
  }

  // Check for existing user
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPasswordAsync(password);
  const trimmedName = typeof fullName === "string" && fullName.trim() ? fullName.trim() : null;

  const [newUser] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      passwordHash,
      fullName: trimmedName,
      role: "student",
      accountStatus: "active",
    })
    .returning({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
    });

  // Automatically log the student in by creating a session
  await createSession(newUser.id);

  return NextResponse.json(
    {
      success: true,
      user: newUser,
    },
    { status: 201 },
  );
}
