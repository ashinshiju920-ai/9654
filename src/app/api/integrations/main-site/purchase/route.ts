import { NextResponse } from "next/server";

import { getAppBaseUrl } from "@/lib/commerce/service";
import { processMainSitePurchase } from "@/lib/integrations/main-site-bridge";

export async function POST(request: Request) {
  const signature =
    request.headers.get("x-webhook-signature") ||
    request.headers.get("x-aylem-signature") ||
    request.headers.get("x-integration-signature") ||
    request.headers.get("x-signature");

  const timestamp =
    request.headers.get("x-webhook-timestamp") ||
    request.headers.get("x-aylem-timestamp") ||
    request.headers.get("x-integration-timestamp") ||
    request.headers.get("x-timestamp");

  if (!signature || !timestamp) {
    return NextResponse.json(
      {
        error:
          "Missing authentication headers. This endpoint requires an authenticated server-to-server request.",
      },
      { status: 401 },
    );
  }

  const rawBody = await request.text();
  const appBaseUrl = await getAppBaseUrl(request);

  const result = await processMainSitePurchase({
    rawBody,
    signature,
    timestamp,
    appBaseUrl,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result, { status: 200 });
}
