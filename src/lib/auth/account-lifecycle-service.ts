import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";

import { getRuntimeEnvValue } from "@/lib/cloudflare/runtime";
import { withDb } from "@/lib/db";
import { emailVerificationTokens, passwordResetTokens, users } from "@/lib/db/schema";
import { resetPasswordTemplate, verifyEmailTemplate, passwordChangedTemplate } from "@/lib/email/templates";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { hashPasswordAsync } from "./password";
import { invalidateAllUserSessions } from "./session";
import {
  EMAIL_VERIFICATION_TTL_MS,
  GENERIC_FORGOT_PASSWORD_MESSAGE,
  PASSWORD_RESET_TTL_MS,
  buildActionUrl,
  generateAccountToken,
  hashAccountToken,
  isValidEmail,
  normalizeEmail,
  safeAppPath,
  validateNewPassword,
} from "./account-lifecycle";

type EmailUser = {
  id: string;
  email: string;
  fullName: string | null;
  accountStatus: string;
  emailVerified: boolean;
};

export async function requestPasswordReset(email: string, requestBaseUrl: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    return;
  }

  const [user] = await withDb((db) =>
    db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        accountStatus: users.accountStatus,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1),
  );

  if (!user || user.accountStatus !== "active") {
    return;
  }

  const rawToken = generateAccountToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);

  await withDb((db) =>
    db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: hashAccountToken(rawToken),
      expiresAt,
    }),
  );

  const baseUrl = (await getRuntimeEnvValue("APP_BASE_URL")) || requestBaseUrl;
  const actionUrl = buildActionUrl({
    baseUrl,
    path: "/reset-password",
    token: rawToken,
  });
  const template = resetPasswordTemplate({ fullName: user.fullName, actionUrl });
  try {
    await sendTransactionalEmail({ to: user.email, ...template });
  } catch {
    // Keep forgot-password enumeration-resistant even if the email provider fails.
  }
}

export async function resetPasswordWithToken(input: {
  token: string;
  password: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const passwordError = validateNewPassword(input.password);
  if (passwordError) {
    return { success: false, error: passwordError };
  }

  const now = new Date();
  const tokenHash = hashAccountToken(input.token);
  const [tokenRow] = await withDb((db) =>
    db
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          gt(passwordResetTokens.expiresAt, now),
          isNull(passwordResetTokens.usedAt),
        ),
      )
      .returning({
        id: passwordResetTokens.id,
        userId: passwordResetTokens.userId,
      }),
  );

  if (!tokenRow) {
    return { success: false, error: "Invalid or expired reset token." };
  }

  const newPasswordHash = await hashPasswordAsync(input.password);
  const [user] = await withDb((db) =>
    db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: now,
      })
      .where(eq(users.id, tokenRow.userId))
      .returning({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
      }),
  );

  await invalidateAllUserSessions(tokenRow.userId);

  if (user) {
    const template = passwordChangedTemplate({ fullName: user.fullName });
    try {
      await sendTransactionalEmail({ to: user.email, ...template });
    } catch {
      // Do not roll back a completed password reset if the confirmation email fails.
    }
  }

  return { success: true };
}

export async function requestEmailVerification(input: {
  userId: string;
  requestBaseUrl: string;
  next?: string | null;
}): Promise<{ status: "sent" | "already_verified" | "missing_user" | "email_not_configured" }> {
  const user = await getEmailUser(input.userId);

  if (!user) {
    return { status: "missing_user" };
  }

  if (user.emailVerified) {
    return { status: "already_verified" };
  }

  const rawToken = generateAccountToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS);

  await withDb((db) =>
    db.insert(emailVerificationTokens).values({
      userId: user.id,
      tokenHash: hashAccountToken(rawToken),
      expiresAt,
    }),
  );

  const baseUrl = (await getRuntimeEnvValue("APP_BASE_URL")) || input.requestBaseUrl;
  const actionUrl = buildActionUrl({
    baseUrl,
    path: "/api/auth/verify-email",
    token: rawToken,
    next: safeAppPath(input.next, "/dashboard"),
  });
  const template = verifyEmailTemplate({ fullName: user.fullName, actionUrl });
  const result = await sendTransactionalEmail({ to: user.email, ...template });

  return { status: result.status === "sent" ? "sent" : "email_not_configured" };
}

export async function verifyEmailToken(token: string): Promise<{
  status: "verified" | "invalid";
}> {
  const now = new Date();
  const tokenHash = hashAccountToken(token);
  const [tokenRow] = await withDb((db) =>
    db
      .update(emailVerificationTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          gt(emailVerificationTokens.expiresAt, now),
          isNull(emailVerificationTokens.usedAt),
        ),
      )
      .returning({
        userId: emailVerificationTokens.userId,
      }),
  );

  if (!tokenRow) {
    return { status: "invalid" };
  }

  await withDb((db) =>
    db
      .update(users)
      .set({ emailVerified: true, updatedAt: now })
      .where(eq(users.id, tokenRow.userId)),
  );

  return { status: "verified" };
}

export { GENERIC_FORGOT_PASSWORD_MESSAGE };

async function getEmailUser(userId: string): Promise<EmailUser | null> {
  const [user] = await withDb((db) =>
    db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        accountStatus: users.accountStatus,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  );

  if (!user || user.accountStatus !== "active") {
    return null;
  }

  return user;
}
