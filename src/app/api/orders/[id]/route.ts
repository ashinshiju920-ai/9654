import { NextResponse } from "next/server";

import { AuthenticationError, requireUser } from "@/lib/auth";
import { getOrderForUser } from "@/lib/commerce/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Unauthorized: Please log in." }, { status: 401 });
    }
    throw error;
  }

  const { id } = await params;
  const order = await getOrderForUser({ user, orderId: id });
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({ order });
}
