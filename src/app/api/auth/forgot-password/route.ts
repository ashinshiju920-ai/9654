import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { randomBytes, createHash } from "node:crypto";
import { eq } from "drizzle-orm";

import { checkAuthRateLimit } from "@/lib/auth";
import { getTrustedClientIdentity } from "@/lib/cloudflare/client-ip";
import { getDb } from "@/lib/db";
import { passwordResetTokens, users } from "@/lib/db/schema";

export async function POST(request: Request) {
  const clientIdentity = await getTrustedClientIdentity(request);

  if (!(await checkAuthRateLimit({ clientIdentity, purpose: "password-reset" }))) {
    return NextResponse.json({
      success: true,
      message:
        "If an account exists with this email, password reset instructions will be sent. (Email delivery integration is currently pending).",
    });
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

  const { email } = body as { email?: string };

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email address is required." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const db = await getDb();

  const userList = await db
    .select({ id: users.id, accountStatus: users.accountStatus })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (userList.length > 0 && userList[0].accountStatus === "active") {
    const user = userList[0];
    const rawToken = Buffer.from(randomBytes(32)).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // NOTE: Email sending integration is pending.
    // In production, sendEmail({ to: normalizedEmail, token: rawToken });
    // Token is NEVER logged or returned to the client.
  }

  // Return generic response to prevent email enumeration attacks
  return NextResponse.json({
    success: true,
    message:
      "If an account exists with this email, password reset instructions will be sent. (Email delivery integration is currently pending).",
  });
}
