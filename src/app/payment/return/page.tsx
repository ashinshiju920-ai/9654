import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, Clock, Loader2, XCircle } from "lucide-react";

import { requireUserOrRedirect } from "@/lib/auth";
import { formatMoneyMinor, verifyAndSyncCashfreeOrder } from "@/lib/commerce/service";

export const dynamic = "force-dynamic";

type PaymentReturnPageProps = {
  searchParams?: Promise<{
    order_id?: string;
  }>;
};

export default async function PaymentReturnPage({ searchParams }: PaymentReturnPageProps) {
  const user = await requireUserOrRedirect("/login?next=/payment/return");
  const params = searchParams ? await searchParams : {};
  const providerOrderId = params.order_id?.trim();

  if (!providerOrderId) {
    return (
      <main className="page payment-return-page">
        <section className="page-header">
          <div>
            <p className="page-kicker">Payment Verification</p>
            <h1 className="page-title">Missing Order Reference</h1>
            <p className="page-subtitle">No payment order ID was received.</p>
          </div>
        </section>

        <section className="payment-status-panel">
          <AlertCircle size={32} aria-hidden="true" />
          <div>
            <h2>Order Not Found</h2>
            <p>We could not match this return to one of your orders.</p>
          </div>
        </section>

        <div className="payment-return-actions">
          <Link className="dashboard-commercial-btn" href="/advanced-mock-test">
            <span>Back to Advanced Mock Tests</span>
          </Link>
          <Link className="dashboard-commercial-btn dashboard-commercial-btn--secondary" href="/dashboard">
            <span>Continue to Dashboard</span>
          </Link>
        </div>
      </main>
    );
  }

  // Actively sync and verify order with Cashfree payments API
  const order = await verifyAndSyncCashfreeOrder({ user, providerOrderId });

  // STRICT REQUIREMENT: "ensure only after payment they will redirected to advanced mocs"
  if (order?.status === "PAID") {
    redirect(`/advanced-mock-test?course=${encodeURIComponent(order.courseSlug)}&payment=success`);
  }

  // If order is NOT paid, do NOT redirect to advanced mocks!
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
        {order ? (
          <Link className="dashboard-commercial-btn" href={`/checkout/${order.productSlug}`}>
            <span>Retry Payment</span>
          </Link>
        ) : (
          <Link className="dashboard-commercial-btn" href="/advanced-mock-test">
            <span>Back to Advanced Mock Tests</span>
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
  if (status === "FAILED" || status === "CANCELLED") {
    return {
      icon: XCircle,
      title: "Payment Unsuccessful",
      heading: "Access was not granted.",
      description: "Payment was not completed. Only after verified payment can you be redirected to Advanced Mock Tests.",
    };
  }

  if (status === "PENDING") {
    return {
      icon: Clock,
      title: "Payment Pending",
      heading: "Awaiting confirmation from Cashfree.",
      description: "Access to Advanced Mock Tests will only be unlocked after verified server-side payment confirmation.",
    };
  }

  return {
    icon: Loader2,
    title: "Payment Not Completed",
    heading: "Access was not unlocked.",
    description: "A successful Cashfree payment confirmation is required to unlock Advanced Mock Tests.",
  };
}
