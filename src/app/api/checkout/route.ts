import { NextResponse } from "next/server";

import { AuthenticationError, requireUser } from "@/lib/auth";
import { createCheckoutSession, getAppBaseUrl } from "@/lib/commerce/service";

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Unauthorized: Please log in." }, { status: 401 });
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const payload = body && typeof body === "object" ? (body as { productSlug?: string; productId?: string }) : {};
  const productSlug = payload.productSlug?.trim().toLowerCase();
  const productId = payload.productId?.trim();

  if (!productSlug && !productId) {
    return NextResponse.json({ error: "Product is required." }, { status: 400 });
  }

  try {
    const checkout = await createCheckoutSession({
      user,
      product: { productSlug, productId },
      appBaseUrl: await getAppBaseUrl(request),
    });

    if (!checkout.ok) {
      return NextResponse.json({ error: checkout.error }, { status: checkout.status });
    }

    return NextResponse.json({
      orderId: checkout.orderId,
      providerOrderId: checkout.providerOrderId,
      paymentSessionId: checkout.paymentSessionId,
      cashfreeEnvironment: checkout.cashfreeEnvironment,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout could not be started." },
      { status: 500 },
    );
  }
}
