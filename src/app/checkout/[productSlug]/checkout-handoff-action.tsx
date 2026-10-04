"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";

type CheckoutHandoffActionProps = {
  productSlug: string;
  formattedPrice: string;
  productName: string;
};

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => {
      checkout(input: { paymentSessionId: string; redirectTarget?: "_self" | "_blank" }): void;
    };
  }
}

export function CheckoutHandoffAction({
  productSlug,
  formattedPrice,
}: CheckoutHandoffActionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleProceedToPay() {
    setLoading(true);
    setError(null);

    try {
      await ensureCashfreeSdk();

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlug }),
      });

      const data = (await res.json()) as {
        error?: string;
        paymentSessionId?: string;
        cashfreeEnvironment?: string;
      };

      if (!res.ok) {
        throw new Error(data?.error || "Unable to start checkout session.");
      }

      if (!data.paymentSessionId) {
        throw new Error("Checkout session missing from payment gateway.");
      }

      const mode = data.cashfreeEnvironment === "PRODUCTION" ? "production" : "sandbox";
      const cashfree = window.Cashfree?.({ mode });
      if (!cashfree) {
        throw new Error("Payment gateway could not be loaded. Please reload.");
      }

      cashfree.checkout({
        paymentSessionId: data.paymentSessionId,
        redirectTarget: "_self",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment initialization failed.");
      setLoading(false);
    }
  }

  return (
    <div className="checkout-handoff-action">
      <button
        type="button"
        disabled={loading}
        onClick={handleProceedToPay}
        className="checkout-pay-btn"
        id="proceed-to-pay-btn"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            <span>Connecting to Cashfree...</span>
          </>
        ) : (
          <>
            <Lock size={18} aria-hidden="true" />
            <span>Proceed to Pay {formattedPrice}</span>
          </>
        )}
      </button>

      {error ? (
        <p className="checkout-error" role="alert" style={{ marginTop: "0.75rem", color: "#dc2626", fontSize: "0.875rem" }}>
          {error}
        </p>
      ) : null}

      <p className="checkout-payment-methods-hint">
        Supports UPI (GPay, PhonePe, Paytm, BHIM), Debit & Credit Cards, and Net Banking via Cashfree Payments.
      </p>
    </div>
  );
}

function ensureCashfreeSdk(): Promise<void> {
  if (window.Cashfree) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-cashfree-sdk]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Cashfree SDK failed to load.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    script.dataset.cashfreeSdk = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Cashfree SDK failed to load."));
    document.head.appendChild(script);
  });
}
