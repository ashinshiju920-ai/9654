import { NextResponse } from "next/server";

import { processCashfreeWebhook } from "@/lib/commerce/service";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await processCashfreeWebhook({
    rawBody,
    signature: request.headers.get("x-webhook-signature"),
    timestamp: request.headers.get("x-webhook-timestamp"),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ received: true });
}
