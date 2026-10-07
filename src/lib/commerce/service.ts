import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import type { SessionUser } from "@/lib/auth";
import { getRuntimeEnvValue } from "@/lib/cloudflare/runtime";
import { withDb } from "@/lib/db";
import {
  commerceOrders,
  commercePayments,
  commerceProducts,
  courseEntitlements,
  courses,
  users,
} from "@/lib/db/schema";
import { type CourseSlug, courses as coursesList } from "@/lib/courses";
import { canUserAccessCourse, grantEntitlement, type AccessTier } from "@/lib/entitlements";
import {
  createCashfreeOrder,
  getCashfreeConfig,
  getCashfreeOrderPayments,
  majorToMinor,
  normalizeCashfreeStatus,
  verifyCashfreeWebhookSignature,
  type CashfreePayment,
  type CashfreeWebhookPayload,
} from "./cashfree";

export const orderStatuses = ["PENDING", "PAID", "FAILED", "CANCELLED"] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export const ADVANCED_PRICE_AMOUNT_MINOR = 29900;
export const ADVANCED_PRICE_CURRENCY = "INR";

export type CheckoutProductIdentifier = {
  productSlug?: string;
  productId?: string;
};

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  courseId: string;
  courseSlug: string;
  courseName: string;
  accessTier: string;
  priceAmountMinor: number;
  currency: string;
  active: boolean;
};

export async function listActiveCommerceProducts() {
  return withDb(async (db) => {
    const rows = await db
      .select(productSelection)
      .from(commerceProducts)
      .innerJoin(courses, eq(commerceProducts.courseId, courses.id))
      .where(and(eq(commerceProducts.active, true), eq(courses.isActive, true)))
      .orderBy(courses.displayOrder, commerceProducts.accessTier);

    return rows.map(withAdvancedPricing);
  });
}

export async function findActiveProductForCourseTier(courseSlug: string, accessTier: AccessTier) {
  const normalizedCourse = courseSlug.trim().toLowerCase();
  const rows = await withDb((db) =>
    db
      .select(productSelection)
      .from(commerceProducts)
      .innerJoin(courses, eq(commerceProducts.courseId, courses.id))
      .where(
        and(
          eq(courses.slug, normalizedCourse),
          eq(courses.isActive, true),
          eq(commerceProducts.accessTier, accessTier),
          eq(commerceProducts.active, true),
        ),
      )
      .limit(1),
  );
  return rows[0] ? withAdvancedPricing(rows[0]) : null;
}

export async function getAdvancedCatalogueStateForUser(user: SessionUser) {
  return withDb(async (db) => {
    const products = await db
      .select({
        slug: commerceProducts.slug,
        courseSlug: courses.slug,
        priceAmountMinor: commerceProducts.priceAmountMinor,
        currency: commerceProducts.currency,
      })
      .from(commerceProducts)
      .innerJoin(courses, eq(commerceProducts.courseId, courses.id))
      .where(
        and(
          eq(commerceProducts.active, true),
          eq(commerceProducts.accessTier, "ADVANCED"),
          eq(courses.isActive, true),
        ),
      );

    const activeCourseSlugsWithAccess = new Set<string>();

    if (user.role === "admin") {
      for (const course of coursesList) {
        activeCourseSlugsWithAccess.add(course.slug);
      }
    } else {
      const userEntitlements = await db
        .select({
          courseSlug: courses.slug,
          accessTier: courseEntitlements.accessTier,
          expiresAt: courseEntitlements.expiresAt,
        })
        .from(courseEntitlements)
        .innerJoin(courses, eq(courseEntitlements.courseId, courses.id))
        .where(
          and(
            eq(courseEntitlements.userId, user.id),
            eq(courseEntitlements.status, "ACTIVE"),
            eq(courseEntitlements.accessTier, "ADVANCED"),
          ),
        );

      const now = new Date();
      let hasAnyAdvanced = false;
      for (const ent of userEntitlements) {
        if (!ent.expiresAt || ent.expiresAt.getTime() > now.getTime()) {
          activeCourseSlugsWithAccess.add(ent.courseSlug);
          hasAnyAdvanced = true;
        }
      }

      if (hasAnyAdvanced) {
        for (const course of coursesList) {
          activeCourseSlugsWithAccess.add(course.slug);
        }
      }
    }

    const productByCourse = new Map(products.map((p) => [p.courseSlug, p]));

    return Object.fromEntries(
      coursesList.map((course) => {
        const prod = productByCourse.get(course.slug);
        return [
          course.slug,
          {
            productSlug: prod?.slug || null,
            priceFormatted: prod
              ? formatMoneyMinor(ADVANCED_PRICE_AMOUNT_MINOR, ADVANCED_PRICE_CURRENCY)
              : null,
            hasAccess: activeCourseSlugsWithAccess.has(course.slug),
          },
        ];
      }),
    ) as Record<CourseSlug, { productSlug: string | null; priceFormatted: string | null; hasAccess: boolean }>;
  });
}

export async function createCheckoutSession(input: {
  user: SessionUser;
  product: CheckoutProductIdentifier;
  appBaseUrl: string;
}) {
  const product = await getActiveProduct(input.product);
  if (!product) {
    return { ok: false as const, status: 404, error: "Product is not available." };
  }

  if (product.accessTier !== "ADVANCED") {
    return {
      ok: false as const,
      status: 400,
      error: "Only Advanced section requires payment. Standard access is free.",
    };
  }

  if (
    await canUserAccessCourse(input.user, product.courseId, product.accessTier as AccessTier)
  ) {
    return {
      ok: false as const,
      status: 409,
      error: `You already have ${product.courseName} ${product.accessTier.toLowerCase()} access.`,
    };
  }

  const providerConfig = await getCashfreeConfig();
  const providerOrderId = createProviderOrderId();
  const [order] = await withDb((db) =>
    db
      .insert(commerceOrders)
      .values({
        userId: input.user.id,
        productId: product.id,
        amountMinor: product.priceAmountMinor,
        currency: product.currency,
        status: "PENDING",
        provider: "CASHFREE",
        providerEnvironment: providerConfig.environment,
        providerOrderId,
      })
      .returning(),
  );

  const returnUrl = `${input.appBaseUrl}/payment/return?order_id=${encodeURIComponent(providerOrderId)}`;
  const notifyUrl = `${input.appBaseUrl}/api/webhooks/cashfree`;

  const cashfreeOrder = await createCashfreeOrder({
    providerOrderId,
    amountMinor: order.amountMinor,
    currency: "INR",
    customer: {
      id: input.user.id,
      email: input.user.email,
      name: input.user.fullName,
    },
    returnUrl,
    notifyUrl,
    productName: product.name,
  });

  await withDb((db) =>
    db
      .update(commerceOrders)
      .set({
        providerSessionId: cashfreeOrder.payment_session_id,
        providerOrderStatus: cashfreeOrder.order_status || null,
        updatedAt: new Date(),
      })
      .where(eq(commerceOrders.id, order.id)),
  );

  return {
    ok: true as const,
    orderId: order.id,
    providerOrderId,
    paymentSessionId: cashfreeOrder.payment_session_id,
    cashfreeEnvironment: providerConfig.environment,
  };
}

export async function getOrderForUser(input: {
  user: SessionUser;
  orderId?: string;
  providerOrderId?: string;
}) {
  const conditions: SQL[] = [];
  if (input.orderId) conditions.push(eq(commerceOrders.id, input.orderId));
  if (input.providerOrderId) conditions.push(eq(commerceOrders.providerOrderId, input.providerOrderId));
  if (input.user.role !== "admin") conditions.push(eq(commerceOrders.userId, input.user.id));
  if (conditions.length === 0) return null;

  const rows = await withDb((db) =>
    db
      .select(orderSelection)
      .from(commerceOrders)
      .innerJoin(commerceProducts, eq(commerceOrders.productId, commerceProducts.id))
      .innerJoin(courses, eq(commerceProducts.courseId, courses.id))
      .innerJoin(users, eq(commerceOrders.userId, users.id))
      .where(and(...conditions))
      .limit(1),
  );

  return rows[0] || null;
}

export async function listPurchasesForUser(user: SessionUser) {
  return withDb((db) =>
    db
      .select(orderSelection)
      .from(commerceOrders)
      .innerJoin(commerceProducts, eq(commerceOrders.productId, commerceProducts.id))
      .innerJoin(courses, eq(commerceProducts.courseId, courses.id))
      .innerJoin(users, eq(commerceOrders.userId, users.id))
      .where(eq(commerceOrders.userId, user.id))
      .orderBy(desc(commerceOrders.createdAt)),
  );
}

export async function listAdminCommerce() {
  return withDb(async (db) => {
    const [products, orders, payments] = await Promise.all([
      db
        .select(productSelection)
        .from(commerceProducts)
        .innerJoin(courses, eq(commerceProducts.courseId, courses.id))
        .orderBy(courses.displayOrder, commerceProducts.accessTier),
      db
        .select(orderSelection)
        .from(commerceOrders)
        .innerJoin(commerceProducts, eq(commerceOrders.productId, commerceProducts.id))
        .innerJoin(courses, eq(commerceProducts.courseId, courses.id))
        .innerJoin(users, eq(commerceOrders.userId, users.id))
        .orderBy(desc(commerceOrders.createdAt))
        .limit(100),
      db
        .select({
          id: commercePayments.id,
          orderId: commercePayments.orderId,
          userId: commercePayments.userId,
          userEmail: users.email,
          providerPaymentId: commercePayments.providerPaymentId,
          status: commercePayments.status,
          amountMinor: commercePayments.amountMinor,
          currency: commercePayments.currency,
          paymentGroup: commercePayments.paymentGroup,
          paymentMessage: commercePayments.paymentMessage,
          eventType: commercePayments.eventType,
          receivedAt: commercePayments.receivedAt,
          createdAt: commercePayments.createdAt,
        })
        .from(commercePayments)
        .innerJoin(users, eq(commercePayments.userId, users.id))
        .orderBy(desc(commercePayments.createdAt))
        .limit(100),
    ]);

    return { products: products.map(withAdvancedPricing), orders, payments };
  });
}

export async function processCashfreeWebhook(input: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
}) {
  if (!input.signature || !input.timestamp) {
    return { ok: false as const, status: 400, error: "Missing Cashfree webhook signature." };
  }

  if (
    !(await verifyCashfreeWebhookSignature({
      rawBody: input.rawBody,
      signature: input.signature,
      timestamp: input.timestamp,
    }))
  ) {
    return { ok: false as const, status: 401, error: "Invalid Cashfree webhook signature." };
  }

  let payload: CashfreeWebhookPayload;
  try {
    payload = JSON.parse(input.rawBody) as CashfreeWebhookPayload;
  } catch {
    return { ok: false as const, status: 400, error: "Malformed webhook payload." };
  }

  const providerOrderId = payload.data?.order?.order_id;
  const webhookPayment = payload.data?.payment;
  const providerPaymentId = stringifyProviderPaymentId(webhookPayment?.cf_payment_id);
  if (!providerOrderId || !providerPaymentId) {
    return { ok: false as const, status: 400, error: "Webhook missing order or payment reference." };
  }

  const verifiedPayments = await getCashfreeOrderPayments(providerOrderId);
  const verifiedPayment =
    verifiedPayments.find(
      (payment) => stringifyProviderPaymentId(payment.cf_payment_id) === providerPaymentId,
    ) || webhookPayment;

  if (!verifiedPayment) {
    return { ok: false as const, status: 400, error: "Webhook payment could not be verified." };
  }

  const result = await recordCashfreePayment({
    providerOrderId,
    eventType: payload.type || null,
    rawBody: input.rawBody,
    payment: verifiedPayment,
    fallbackErrorCode: payload.data?.error_details?.error_code,
  });

  return { ok: true as const, ...result };
}

export async function recordCashfreePayment(input: {
  providerOrderId: string;
  eventType?: string | null;
  rawBody?: string | null;
  payment: CashfreePayment;
  fallbackErrorCode?: string;
}) {
  const paymentStatus = normalizeCashfreeStatus(input.payment.payment_status);
  const providerPaymentId = stringifyProviderPaymentId(input.payment.cf_payment_id);
  if (!providerPaymentId) {
    return { processed: false, reason: "missing_payment_id" };
  }

  return withDb(async (db) => {
    const rows = await db
      .select({
        order: commerceOrders,
        product: commerceProducts,
      })
      .from(commerceOrders)
      .innerJoin(commerceProducts, eq(commerceOrders.productId, commerceProducts.id))
      .where(eq(commerceOrders.providerOrderId, input.providerOrderId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return { processed: false, reason: "unknown_order" };
    }

    const paymentAmountMinor = majorToMinor(input.payment.payment_amount);
    const paymentCurrency = input.payment.payment_currency || input.payment.order_currency || "";
    const amountMatches = paymentAmountMinor === row.order.amountMinor;
    const currencyMatches = paymentCurrency === row.order.currency;
    const now = new Date();

    await db
      .insert(commercePayments)
      .values({
        orderId: row.order.id,
        userId: row.order.userId,
        provider: "CASHFREE",
        providerPaymentId,
        status: paymentStatus,
        amountMinor: paymentAmountMinor ?? 0,
        currency: paymentCurrency || row.order.currency,
        eventType: input.eventType || null,
        paymentGroup: input.payment.payment_group || null,
        paymentMessage: input.payment.payment_message || null,
        bankReference: input.payment.bank_reference || null,
        errorCode: input.payment.error_details?.error_code || input.fallbackErrorCode || null,
        rawProviderStatus: input.payment.payment_status || null,
        providerPaymentTime: parseProviderDate(
          input.payment.payment_completion_time || input.payment.payment_time,
        ),
        rawPayload: input.rawBody || null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [commercePayments.provider, commercePayments.providerPaymentId],
        set: {
          status: paymentStatus,
          amountMinor: paymentAmountMinor ?? 0,
          currency: paymentCurrency || row.order.currency,
          eventType: input.eventType || null,
          paymentMessage: input.payment.payment_message || null,
          rawProviderStatus: input.payment.payment_status || null,
          updatedAt: now,
        },
      });

    if (paymentStatus !== "SUCCESS") {
      if (paymentStatus === "FAILED" || paymentStatus === "USER_DROPPED" || paymentStatus === "CANCELLED") {
        await db
          .update(commerceOrders)
          .set({
            status: paymentStatus === "USER_DROPPED" ? "CANCELLED" : "FAILED",
            failureReason: input.payment.payment_message || paymentStatus,
            updatedAt: now,
            cancelledAt: paymentStatus === "USER_DROPPED" || paymentStatus === "CANCELLED" ? now : null,
          })
          .where(and(eq(commerceOrders.id, row.order.id), ne(commerceOrders.status, "PAID")));
      }
      return { processed: true, status: paymentStatus, entitlementGranted: false };
    }

    if (!amountMatches || !currencyMatches) {
      await db
        .update(commerceOrders)
        .set({
          status: "FAILED",
          failureReason: !amountMatches ? "amount_mismatch" : "currency_mismatch",
          updatedAt: now,
        })
        .where(and(eq(commerceOrders.id, row.order.id), ne(commerceOrders.status, "PAID")));

      return {
        processed: true,
        status: paymentStatus,
        entitlementGranted: false,
        reason: !amountMatches ? "amount_mismatch" : "currency_mismatch",
      };
    }

    await db
      .update(commerceOrders)
      .set({
        status: "PAID",
        providerOrderStatus: "PAID",
        paidAt: now,
        failureReason: null,
        updatedAt: now,
      })
      .where(and(eq(commerceOrders.id, row.order.id), ne(commerceOrders.status, "PAID")));

    let createdAny = false;
    if (row.product.accessTier === "ADVANCED") {
      const allActiveCourses = await db
        .select({ id: courses.id, slug: courses.slug })
        .from(courses)
        .where(eq(courses.isActive, true));

      for (const course of allActiveCourses) {
        const ent = await grantEntitlement({
          userId: row.order.userId,
          courseId: course.id,
          accessTier: "ADVANCED",
          source: "CASHFREE",
          expiresAt: null,
          externalReference: `cashfree:${input.providerOrderId}:${providerPaymentId}:${course.slug}`,
        });
        if (ent.created) createdAny = true;
      }
    } else {
      const ent = await grantEntitlement({
        userId: row.order.userId,
        courseId: row.product.courseId,
        accessTier: row.product.accessTier as AccessTier,
        source: "CASHFREE",
        expiresAt: null,
        externalReference: `cashfree:${input.providerOrderId}:${providerPaymentId}`,
      });
      if (ent.created) createdAny = true;
    }

    return {
      processed: true,
      status: paymentStatus,
      entitlementGranted: true,
      entitlementCreated: createdAny,
    };
  });
}

export async function verifyAndSyncCashfreeOrder(input: {
  user: SessionUser;
  providerOrderId: string;
}) {
  let order = await getOrderForUser({
    user: input.user,
    providerOrderId: input.providerOrderId,
  });

  if (!order) {
    return null;
  }

  if (order.status === "PAID") {
    return order;
  }

  try {
    const verifiedPayments = await getCashfreeOrderPayments(input.providerOrderId);
    if (Array.isArray(verifiedPayments) && verifiedPayments.length > 0) {
      const successPayment = verifiedPayments.find(
        (p) => normalizeCashfreeStatus(p.payment_status) === "SUCCESS",
      );
      const paymentToProcess = successPayment || verifiedPayments[verifiedPayments.length - 1];

      if (paymentToProcess) {
        await recordCashfreePayment({
          providerOrderId: input.providerOrderId,
          payment: paymentToProcess,
        });

        order = await getOrderForUser({
          user: input.user,
          providerOrderId: input.providerOrderId,
        });
      }
    }
  } catch (error) {
    console.error("Failed to sync Cashfree payment on return:", error);
  }

  return order;
}

export async function getAppBaseUrl(request: Request) {
  const configured = await getRuntimeEnvValue("APP_BASE_URL");
  if (configured) return configured.replace(/\/$/, "");
  const url = new URL(request.url);
  return url.origin;
}

export function formatMoneyMinor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export async function getActiveProduct(identifier: CheckoutProductIdentifier): Promise<ProductRow | null> {
  const productSlug = identifier.productSlug?.trim().toLowerCase();
  const productId = identifier.productId?.trim();
  if (!productSlug && !productId) return null;

  const conditions: SQL[] = [eq(commerceProducts.active, true), eq(courses.isActive, true)];
  if (productSlug) conditions.push(eq(commerceProducts.slug, productSlug));
  if (productId) conditions.push(eq(commerceProducts.id, productId));

  const rows = await withDb((db) =>
    db
      .select(productSelection)
      .from(commerceProducts)
      .innerJoin(courses, eq(commerceProducts.courseId, courses.id))
      .where(and(...conditions))
      .limit(1),
  );
  return rows[0] ? withAdvancedPricing(rows[0]) : null;
}

const productSelection = {
  id: commerceProducts.id,
  slug: commerceProducts.slug,
  name: commerceProducts.name,
  description: commerceProducts.description,
  courseId: commerceProducts.courseId,
  courseSlug: courses.slug,
  courseName: courses.name,
  accessTier: commerceProducts.accessTier,
  priceAmountMinor: commerceProducts.priceAmountMinor,
  currency: commerceProducts.currency,
  active: commerceProducts.active,
  createdAt: commerceProducts.createdAt,
  updatedAt: commerceProducts.updatedAt,
};

const orderSelection = {
  id: commerceOrders.id,
  userId: commerceOrders.userId,
  userEmail: users.email,
  productId: commerceOrders.productId,
  productSlug: commerceProducts.slug,
  productName: commerceProducts.name,
  courseSlug: courses.slug,
  courseName: courses.name,
  accessTier: commerceProducts.accessTier,
  amountMinor: commerceOrders.amountMinor,
  currency: commerceOrders.currency,
  status: commerceOrders.status,
  provider: commerceOrders.provider,
  providerEnvironment: commerceOrders.providerEnvironment,
  providerOrderId: commerceOrders.providerOrderId,
  providerOrderStatus: commerceOrders.providerOrderStatus,
  failureReason: commerceOrders.failureReason,
  paidAt: commerceOrders.paidAt,
  cancelledAt: commerceOrders.cancelledAt,
  createdAt: commerceOrders.createdAt,
  updatedAt: commerceOrders.updatedAt,
};

function withAdvancedPricing<T extends Pick<ProductRow, "accessTier" | "priceAmountMinor" | "currency">>(
  product: T,
): T {
  if (product.accessTier !== "ADVANCED") return product;

  return {
    ...product,
    priceAmountMinor: ADVANCED_PRICE_AMOUNT_MINOR,
    currency: ADVANCED_PRICE_CURRENCY,
  };
}

function createProviderOrderId() {
  return `aylem_${crypto.randomUUID().replaceAll("-", "").slice(0, 32)}`;
}

function stringifyProviderPaymentId(value: string | number | undefined) {
  if (typeof value === "number") return String(value);
  return value?.trim() || null;
}

function parseProviderDate(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
