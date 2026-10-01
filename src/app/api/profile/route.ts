import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function GET() {
  let sessionUser;
  try {
    sessionUser = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const userList = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      accountStatus: users.accountStatus,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);

  if (userList.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ profile: userList[0] });
}

export async function PATCH(request: Request) {
  let sessionUser;
  try {
    sessionUser = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const { fullName } = body as { fullName?: string };

  // Only permit updating fullName - ignore or reject any attempts to update role/status/email
  const sanitizedName = typeof fullName === "string" ? fullName.trim() : null;

  const db = await getDb();
  const [updated] = await db
    .update(users)
    .set({
      fullName: sanitizedName,
      updatedAt: new Date(),
    })
    .where(eq(users.id, sessionUser.id))
    .returning({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      accountStatus: users.accountStatus,
    });

  return NextResponse.json({ success: true, profile: updated });
}
