import "server-only";

import { getRuntimeEnvValue } from "@/lib/cloudflare/runtime";

export type CashfreeEnvironment = "SANDBOX" | "PRODUCTION";

export type CashfreeConfig = {
  environment: CashfreeEnvironment;
  clientId: string;
  clientSecret: string;
  apiVersion: string;
  baseUrl: string;
};

export type CashfreeOrderResponse = {
  cf_order_id?: string;
  order_id: string;
  order_status?: string;
  order_amount?: number;
  order_currency?: string;
  payment_session_id: string;
};

export type CashfreePaymentStatus =
  | "SUCCESS"
  | "FAILED"
  | "PENDING"
  | "USER_DROPPED"
  | "CANCELLED"
  | "UNKNOWN";

export type CashfreePayment = {
  cf_payment_id?: string | number;
  order_id?: string;
  payment_status?: string;
  payment_amount?: number;
  payment_currency?: string;
  order_amount?: number;
  order_currency?: string;
  payment_time?: string;
  payment_completion_time?: string;
  payment_group?: string;
  payment_message?: string;
  bank_reference?: string | null;
  error_details?: {
    error_code?: string;
  } | null;
};

export type CashfreeWebhookPayload = {
  type?: string;
  event_time?: string;
  data?: {
    order?: {
      order_id?: string;
      order_amount?: number;
      order_currency?: string;
    };
    payment?: CashfreePayment;
    error_details?: {
      error_code?: string;
    } | null;
  };
};

export async function getCashfreeConfig(): Promise<CashfreeConfig> {
  const environmentValue = (await getRuntimeEnvValue("CASHFREE_ENVIRONMENT")) || "SANDBOX";
  const environment = environmentValue.trim().toUpperCase() === "PRODUCTION" ? "PRODUCTION" : "SANDBOX";
  const clientId = (await getRuntimeEnvValue("CASHFREE_CLIENT_ID"))?.trim().replace(/^["']|["']$/g, "");
  const clientSecret = (await getRuntimeEnvValue("CASHFREE_CLIENT_SECRET"))?.trim().replace(/^["']|["']$/g, "");
  const apiVersion = ((await getRuntimeEnvValue("CASHFREE_API_VERSION")) || "2026-01-01").trim();

  if (!clientId || !clientSecret) {
    throw new Error("Cashfree credentials are not configured.");
  }

  return {
    environment,
    clientId,
    clientSecret,
    apiVersion,
    baseUrl:
      environment === "PRODUCTION"
        ? "https://api.cashfree.com"
        : "https://sandbox.cashfree.com",
  };
}

export async function getCashfreePublicConfig() {
  const environmentValue = (await getRuntimeEnvValue("CASHFREE_ENVIRONMENT")) || "SANDBOX";
  return {
    environment: environmentValue.trim().toUpperCase() === "PRODUCTION" ? "PRODUCTION" : "SANDBOX",
  } as const;
}

export async function createCashfreeOrder(input: {
  providerOrderId: string;
  amountMinor: number;
  currency: "INR";
  customer: {
    id: string;
    email: string;
    name?: string | null;
  };
  returnUrl: string;
  notifyUrl: string;
  productName: string;
}) {
  const config = await getCashfreeConfig();

  const response = await fetch(`${config.baseUrl}/pg/orders`, {
    method: "POST",
    headers: cashfreeHeaders(config, {
      "Content-Type": "application/json",
      "x-idempotency-key": input.providerOrderId,
    }),
    body: JSON.stringify({
      order_id: input.providerOrderId,
      order_amount: minorToMajor(input.amountMinor),
      order_currency: input.currency,
      customer_details: {
        customer_id: input.customer.id,
        customer_email: input.customer.email,
        customer_name: input.customer.name || undefined,
        customer_phone: "9999999999",
      },
      order_meta: {
        return_url: input.returnUrl,
        notify_url: input.notifyUrl,
      },
      order_note: input.productName.slice(0, 200),
      order_tags: {
        product: input.productName.slice(0, 80),
      },
    }),
  });

  const data = (await response.json().catch(() => null)) as {
    message?: string;
    code?: string;
    type?: string;
    payment_session_id?: string;
    order_id?: string;
  } | null;

  if (!response.ok || !data?.payment_session_id) {
    const errorMsg = data?.message || data?.code || `Cashfree order creation failed (${response.status})`;
    throw new Error(errorMsg);
  }

  return data as CashfreeOrderResponse;
}

export async function getCashfreeOrderPayments(providerOrderId: string) {
  const config = await getCashfreeConfig();
  const response = await fetch(
    `${config.baseUrl}/pg/orders/${encodeURIComponent(providerOrderId)}/payments`,
    {
      method: "GET",
      headers: cashfreeHeaders(config),
    },
  );

  const data = (await response.json().catch(() => null)) as { message?: string } | unknown[] | null;
  if (!response.ok || !Array.isArray(data)) {
    const message = data && !Array.isArray(data) ? data.message : undefined;
    throw new Error(typeof message === "string" ? message : "Cashfree payment verification failed.");
  }

  return data as CashfreePayment[];
}

export async function verifyCashfreeWebhookSignature(input: {
  rawBody: string;
  timestamp: string;
  signature: string;
}) {
  const config = await getCashfreeConfig();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(config.clientSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${input.timestamp}${input.rawBody}`),
  );
  const expected = arrayBufferToBase64(signatureBuffer);
  return constantTimeEqual(expected, input.signature);
}

export function normalizeCashfreeStatus(status: string | undefined): CashfreePaymentStatus {
  const normalized = (status || "").trim().toUpperCase();
  if (
    normalized === "SUCCESS" ||
    normalized === "FAILED" ||
    normalized === "PENDING" ||
    normalized === "USER_DROPPED" ||
    normalized === "CANCELLED"
  ) {
    return normalized;
  }
  return "UNKNOWN";
}

export function minorToMajor(amountMinor: number) {
  return Number((amountMinor / 100).toFixed(2));
}

export function majorToMinor(amount: number | undefined) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function cashfreeHeaders(config: CashfreeConfig, extra?: Record<string, string>) {
  return {
    Accept: "application/json",
    "x-api-version": config.apiVersion,
    "x-client-id": config.clientId,
    "x-client-secret": config.clientSecret,
    ...extra,
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function constantTimeEqual(a: string, b: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const max = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let i = 0; i < max; i += 1) {
    diff |= (left[i] || 0) ^ (right[i] || 0);
  }

  return diff === 0;
}
