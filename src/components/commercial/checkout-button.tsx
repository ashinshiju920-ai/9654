"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Loader2, Lock } from "lucide-react";

type CheckoutButtonProps = {
  productSlug: string;
  label: string;
  className: string;
  style?: CSSProperties;
};

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => {
      checkout(input: { paymentSessionId: string; redirectTarget?: "_self" | "_blank" }): void;
    };
  }
}

export function CheckoutButton({ productSlug, label, className, style }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);

    try {
      await ensureCashfreeSdk();
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlug }),
      });
      const data = (await response.json()) as {
        error?: string;
        paymentSessionId?: string;
        cashfreeEnvironment?: string;
      };

      if (!response.ok) {
        throw new Error(data?.error || "Checkout could not be started.");
      }

      if (!data.paymentSessionId) {
        throw new Error("Checkout response was missing a payment session.");
      }

      const mode = data.cashfreeEnvironment === "PRODUCTION" ? "production" : "sandbox";
      window.Cashfree?.({ mode }).checkout({
        paymentSessionId: data.paymentSessionId,
        redirectTarget: "_self",
      });
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error ? checkoutError.message : "Checkout could not be started.",
      );
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        className={className}
        disabled={loading}
        onClick={startCheckout}
        style={style}
        type="button"
      >
        {loading ? <Loader2 size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
        <span>{loading ? "Opening checkout" : label}</span>
      </button>
      {error && <p className="checkout-error">{error}</p>}
    </div>
  );
}

function ensureCashfreeSdk() {
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
