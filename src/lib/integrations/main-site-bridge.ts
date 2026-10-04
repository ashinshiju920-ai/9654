import "server-only";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";

import { hashPasswordAsync } from "@/lib/auth/password";
import {
  buildActionUrl,
  generateAccountToken,
  hashAccountToken,
  isValidEmail,
  normalizeEmail,
} from "@/lib/auth/account-lifecycle";
import { getRuntimeEnvValue } from "@/lib/cloudflare/runtime";
import { withDb } from "@/lib/db";
import {
  courses,
  mainSitePurchaseEvents,
  passwordResetTokens,
  users,
} from "@/lib/db/schema";
import { accountActivationTemplate } from "@/lib/email/templates";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { grantEntitlement, type AccessTier } from "@/lib/entitlements";
import {
  resolveMainSiteCourseAccess,
  type ResolveCourseAccessInput,
} from "./main-site-mapping";

export const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

export type MainSitePurchasePayload = ResolveCourseAccessInput & {
  orderId: string;
  customerEmail: string;
  customerName?: string | null;
  paymentStatus: string;
  amount?: number | string | null;
  currency?: string | null;
  timestamp?: number | string | null;
};

export type ProcessPurchaseResult =
  | {
      success: true;
      idempotent?: boolean;
      orderId: string;
      externalReference: string;
      email: string;
      courseSlug: string;
      accessTier: AccessTier;
      isNewStudent: boolean;
      emailSent?: boolean;
      message?: string;
    }
  | {
      success: false;
      status: number;
      error: string;
    };

/**
 * Constant-time equality comparison between two strings to resist timing attacks.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createMainSiteSignature(input: {
  rawBody: string;
  timestamp: string;
  secret: string;
}): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(input.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${input.timestamp}${input.rawBody}`),
  );
  return bytesToHex(new Uint8Array(signature));
}

/**
 * Verify HMAC-SHA256 signature for server-to-server requests.
 * Canonical string: `${timestamp}${rawBody}`
 */
export async function verifyMainSiteSignature(input: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  now?: number;
}): Promise<{ valid: boolean; reason?: string }> {
  if (!input.timestamp || input.timestamp.trim().length === 0) {
    return { valid: false, reason: "Missing timestamp header." };
  }
  if (!input.signature || input.signature.trim().length === 0) {
    return { valid: false, reason: "Missing signature header." };
  }

  // Verify timestamp freshness
  const rawTs = Number(input.timestamp);
  if (!Number.isFinite(rawTs)) {
    return { valid: false, reason: "Invalid timestamp format." };
  }

  // Handle seconds vs milliseconds timestamps
  const timestampMs = rawTs < 1e11 ? rawTs * 1000 : rawTs;
  const currentNow = input.now ?? Date.now();
  if (Math.abs(currentNow - timestampMs) > MAX_TIMESTAMP_DRIFT_MS) {
    return { valid: false, reason: "Timestamp is outside the allowed tolerance window." };
  }

  const expectedHex = await createMainSiteSignature({
    rawBody: input.rawBody,
    timestamp: input.timestamp,
    secret: input.secret,
  });
  const provided = normalizeSignature(input.signature);

  // Support both hex and base64 provided signatures
  let match = constantTimeEqual(expectedHex.toLowerCase(), provided.toLowerCase());
  if (!match) {
    // Check if provided was base64
    const expectedBase64 = hexToBase64(expectedHex);
    match = constantTimeEqual(expectedBase64, provided);
  }

  return match ? { valid: true } : { valid: false, reason: "Invalid signature." };
}

/**
 * Process verified purchase dispatched from main website.
 */
export async function processMainSitePurchase(input: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  appBaseUrl?: string;
  now?: Date;
}): Promise<ProcessPurchaseResult> {
  const secret =
    (await getRuntimeEnvValue("MAIN_SITE_INTEGRATION_SECRET")) ||
    process.env.MAIN_SITE_INTEGRATION_SECRET;

  if (!secret) {
    return {
      success: false,
      status: 500,
      error: "Integration secret is not configured on the portal.",
    };
  }

  // 1. Verify Signature & Timestamp Freshness
  const sigResult = await verifyMainSiteSignature({
    rawBody: input.rawBody,
    timestamp: input.timestamp,
    signature: input.signature,
    secret,
    now: input.now ? input.now.getTime() : undefined,
  });

  if (!sigResult.valid) {
    return {
      success: false,
      status: 401,
      error: sigResult.reason || "Unauthorized integration request.",
    };
  }

  // 2. Parse JSON payload
  let payload: MainSitePurchasePayload;
  try {
    payload = JSON.parse(input.rawBody) as MainSitePurchasePayload;
  } catch {
    return {
      success: false,
      status: 400,
      error: "Malformed JSON payload.",
    };
  }

  const orderId = payload.orderId?.trim();
  if (!orderId) {
    return {
      success: false,
      status: 400,
      error: "Order ID is required.",
    };
  }
  const productIdentity = getProductIdentity(payload);

  // 3. Verify Payment Status === "PAID"
  const normalizedPaymentStatus = (payload.paymentStatus || "").trim().toUpperCase();
  if (normalizedPaymentStatus !== "PAID") {
    // Record event as ignored non-paid
    await withDb(async (db) => {
      await db
        .insert(mainSitePurchaseEvents)
        .values({
          externalOrderId: orderId,
          externalReference: buildMainSiteExternalReference({
            orderId,
            productKey: productIdentity || "unknown-product",
            courseSlug: "unmapped",
            accessTier: "STANDARD",
          }),
          customerEmail: payload.customerEmail || "unknown",
          courseSlug: payload.courseSlug || "unspecified",
          accessTier: payload.accessTier || "STANDARD",
          paymentStatus: normalizedPaymentStatus || "UNKNOWN",
          eventStatus: "IGNORED_NON_PAID",
          failureReason: `Payment status is ${normalizedPaymentStatus}, only PAID is processed.`,
        })
        .onConflictDoNothing();
    });

    return {
      success: false,
      status: 400,
      error: `Only PAID orders can be provisioned (received: ${normalizedPaymentStatus || "none"}).`,
    };
  }

  // 4. Validate & Normalize Email
  const rawEmail = payload.customerEmail?.trim();
  if (!rawEmail) {
    return {
      success: false,
      status: 400,
      error: "Customer email is required.",
    };
  }

  const normalizedEmail = normalizeEmail(rawEmail);
  if (!isValidEmail(normalizedEmail)) {
    return {
      success: false,
      status: 400,
      error: "Invalid customer email address format.",
    };
  }

  // 5. Resolve Course & Access Tier deterministically
  let courseAccess;
  try {
    courseAccess = await resolveMainSiteCourseAccess(payload);
  } catch (error) {
    return {
      success: false,
      status: 500,
      error: error instanceof Error ? error.message : "Main-site product mapping is invalid.",
    };
  }
  if (!courseAccess.ok) {
    return {
      success: false,
      status: 400,
      error: courseAccess.error,
    };
  }

  const { courseSlug, accessTier, productKey } = courseAccess;
  const externalReference = buildMainSiteExternalReference({
    orderId,
    productKey,
    courseSlug,
    accessTier,
  });

  // 6. Execute atomic provisioning in DB
  const baseUrl =
    input.appBaseUrl ||
    (await getRuntimeEnvValue("APP_BASE_URL")) ||
    process.env.APP_BASE_URL ||
    "https://portal.aylemlearning.online";

  return withDb(async (db) => {
    // 6a. Idempotency Check: check if order was already successfully processed
    const existingEvents = await db
      .select({
        id: mainSitePurchaseEvents.id,
        eventStatus: mainSitePurchaseEvents.eventStatus,
        userId: mainSitePurchaseEvents.userId,
        customerEmail: mainSitePurchaseEvents.customerEmail,
        courseSlug: mainSitePurchaseEvents.courseSlug,
        accessTier: mainSitePurchaseEvents.accessTier,
      })
      .from(mainSitePurchaseEvents)
      .where(eq(mainSitePurchaseEvents.externalReference, externalReference))
      .limit(1);

    if (existingEvents.length > 0 && existingEvents[0].eventStatus === "PROCESSED") {
      return {
        success: true,
        idempotent: true,
        orderId,
        externalReference,
        email: existingEvents[0].customerEmail,
        courseSlug: existingEvents[0].courseSlug,
        accessTier: existingEvents[0].accessTier as AccessTier,
        isNewStudent: false,
        message: "Order has already been provisioned.",
      };
    }

    // 6b. Resolve Target Course
    const [targetCourse] = await db
      .select({ id: courses.id, slug: courses.slug, name: courses.name, isActive: courses.isActive })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!targetCourse || !targetCourse.isActive) {
      return {
        success: false,
        status: 404,
        error: `Target portal course not found or inactive: ${courseSlug}`,
      };
    }

    // 6c. Match or Create Student
    const [existingUser] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        accountStatus: users.accountStatus,
      })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    let userId: string;
    let isNewStudent = false;
    let emailSent = false;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      isNewStudent = true;
      const randomPassword = randomBytes(32).toString("hex");
      const passwordHash = await hashPasswordAsync(randomPassword);
      const studentName = payload.customerName?.trim() || null;

      const [newUser] = await db
        .insert(users)
        .values({
          email: normalizedEmail,
          passwordHash,
          fullName: studentName,
          role: "student",
          accountStatus: "active",
          emailVerified: true, // Verified by authentic purchase
        })
        .returning({ id: users.id, email: users.email, fullName: users.fullName });

      userId = newUser.id;

      // Generate single-use password activation token (7-day validity)
      const rawToken = generateAccountToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await db.insert(passwordResetTokens).values({
        userId,
        tokenHash: hashAccountToken(rawToken),
        expiresAt,
      });

      const actionUrl = buildActionUrl({
        baseUrl,
        path: "/reset-password",
        token: rawToken,
      });

      const template = accountActivationTemplate({
        fullName: studentName,
        actionUrl,
        courseName: targetCourse.name,
      });

      // Send transactional email (failure does NOT rollback entitlement)
      try {
        const sendResult = await sendTransactionalEmail({ to: normalizedEmail, ...template });
        emailSent = sendResult.status === "sent";
      } catch (emailErr) {
        console.error(
          `[MainSiteBridge] Failed to send activation email to ${normalizedEmail}:`,
          emailErr instanceof Error ? emailErr.message : emailErr,
        );
        emailSent = false;
      }
    }

    // 6d. Grant Entitlement (Hierarchical: ADVANCED automatically unlocks STANDARD)
    await grantEntitlement({
      userId,
      courseId: targetCourse.id,
      accessTier,
      source: "MAIN_SITE_PURCHASE",
      expiresAt: null,
      externalReference,
    });

    // 6e. Record Audit Event
    await db
      .insert(mainSitePurchaseEvents)
      .values({
        externalOrderId: orderId,
        externalReference,
        userId,
        customerEmail: normalizedEmail,
        courseId: targetCourse.id,
        courseSlug,
        accessTier,
        paymentStatus: "PAID",
        eventStatus: "PROCESSED",
        failureReason: isNewStudent && !emailSent ? "Activation email was not delivered." : null,
        metadata: JSON.stringify({ isNewStudent, emailSent }),
        processedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [mainSitePurchaseEvents.externalReference],
        set: {
          eventStatus: "PROCESSED",
          userId,
          customerEmail: normalizedEmail,
          courseId: targetCourse.id,
          courseSlug,
          accessTier,
          failureReason: isNewStudent && !emailSent ? "Activation email was not delivered." : null,
          metadata: JSON.stringify({ isNewStudent, emailSent }),
          processedAt: new Date(),
        },
      });

    return {
      success: true,
      orderId,
      externalReference,
      email: normalizedEmail,
      courseSlug,
      accessTier,
      isNewStudent,
      emailSent,
    };
  });
}

export function buildMainSiteExternalReference(input: {
  orderId: string;
  productKey: string;
  courseSlug: string;
  accessTier: AccessTier;
}): string {
  return `main-site:${input.orderId}:${input.productKey}:${input.courseSlug}:${input.accessTier}`;
}

function getProductIdentity(payload: ResolveCourseAccessInput): string | null {
  return [
    payload.productId,
    payload.productSlug,
    payload.courseKey,
    payload.courseCategory,
    payload.courseSlug,
  ]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0)
    ?.trim()
    .toLowerCase() ?? null;
}

function normalizeSignature(signature: string): string {
  const trimmed = signature.trim();
  return trimmed.toLowerCase().startsWith("sha256=") ? trimmed.slice("sha256=".length) : trimmed;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBase64(hex: string): string {
  const bytes = hex.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [];
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
