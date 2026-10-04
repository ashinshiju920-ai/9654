import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";

import { requireUserOrRedirect } from "@/lib/auth";
import { formatMoneyMinor, getOrderForUser } from "@/lib/commerce/service";

export const dynamic = "force-dynamic";

type PaymentReturnPageProps = {
  searchParams?: Promise<{
    order_id?: string;
  }>;
};

export default async function PaymentReturnPage({ searchParams }: PaymentReturnPageProps) {
  const user = await requireUserOrRedirect("/login?next=/payment/return");
  const params = searchParams ? await searchParams : {};
  const providerOrderId = params.order_id;
  const order = providerOrderId ? await getOrderForUser({ user, providerOrderId }) : null;

  const state = getReturnState(order?.status);
  const Icon = state.icon;

  return (
    <main className="page payment-return-page">
      <section className="page-header">
        <div>
          <p className="page-kicker">Payment Status</p>
          <h1 className="page-title">{state.title}</h1>
          <p className="page-subtitle">{state.description}</p>
        </div>
      </section>

      <section className="payment-status-panel">
        <Icon size={32} aria-hidden="true" />
        <div>
          <h2>{state.heading}</h2>
          {order ? (
            <p>
              {order.productName} • {formatMoneyMinor(order.amountMinor, order.currency)}
            </p>
          ) : (
            <p>We could not match this return to one of your orders.</p>
          )}
        </div>
      </section>

      <div className="payment-return-actions">
        {order?.status === "PAID" && (
          <Link className="dashboard-commercial-btn" href={`/courses/${order.courseSlug}/quiz`}>
            <span>Open Advanced Practice</span>
          </Link>
        )}
        <Link className="dashboard-commercial-btn dashboard-commercial-btn--secondary" href="/purchases">
          <span>View purchases</span>
        </Link>
        <Link className="dashboard-commercial-btn dashboard-commercial-btn--secondary" href="/dashboard">
          <span>Continue to My Learning</span>
        </Link>
      </div>
    </main>
  );
}

function getReturnState(status: string | undefined) {
  if (status === "PAID") {
    return {
      icon: CheckCircle2,
      title: "Payment Confirmed",
      heading: "Your access is ready.",
      description: "Cashfree has verified the payment and your course entitlement is active.",
    };
  }

  if (status === "FAILED" || status === "CANCELLED") {
    return {
      icon: AlertCircle,
      title: "Payment Unsuccessful",
      heading: "Access was not granted.",
      description: "The order was not completed successfully. You can retry checkout from the course page.",
    };
  }

  if (status === "PENDING") {
    return {
      icon: Clock,
      title: "Payment Pending",
      heading: "We are waiting for confirmation.",
      description: "The return page cannot grant access. Your access will unlock after verified server-side confirmation.",
    };
  }

  return {
    icon: Loader2,
    title: "Checking Payment...",
    heading: "Checking your order.",
    description: "A successful return URL alone does not unlock access.",
  };
}
