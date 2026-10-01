import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";

import { hashPassword, invalidateAllUserSessions } from "@/lib/auth";
import { db } from "@/lib/db";
import { passwordResetTokens, users } from "@/lib/db/schema";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { token, password } = body as { token?: string; password?: string };

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters long." },
      { status: 400 },
    );
  }

  if (!token || typeof token !== "string") {
    return NextResponse.json(
      { error: "A valid reset token is required. (Email delivery integration is pending)." },
      { status: 400 },
    );
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();

  const tokenRows = await db
    .select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
    })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        gt(passwordResetTokens.expiresAt, now),
        isNull(passwordResetTokens.usedAt),
      ),
    )
    .limit(1);

  if (tokenRows.length === 0) {
    return NextResponse.json(
      { error: "Invalid or expired reset token." },
      { status: 400 },
    );
  }

  const tokenRow = tokenRows[0];
  const newPasswordHash = hashPassword(password);

  // Update user's password
  await db
    .update(users)
    .set({
      passwordHash: newPasswordHash,
      updatedAt: now,
    })
    .where(eq(users.id, tokenRow.userId));

  // Invalidate all existing sessions upon password change
  await invalidateAllUserSessions(tokenRow.userId);

  // Mark token as used
  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(eq(passwordResetTokens.id, tokenRow.id));

  return NextResponse.json({ success: true });
}
