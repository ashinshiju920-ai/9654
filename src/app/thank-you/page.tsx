import { ArrowRight, Check } from "lucide-react";

import { ButtonLink } from "@/components/ui";

export default function ThankYouPage() {
  return (
    <div className="auth-page">
      <section className="auth-card auth-card--success">
        <span className="success-leaf success-leaf--top" aria-hidden="true" />
        <span className="success-leaf success-leaf--bottom" aria-hidden="true" />
        <div className="success-check" aria-hidden="true">
          <Check size={46} />
        </div>
        <p className="page-kicker">Purchase Complete</p>
        <h1>Payment Successful!</h1>
        <p>
          Thank you for your purchase. You can now access your learning materials in the Aylem
          Student Portal.
        </p>
        <ButtonLink href="/dashboard" size="lg">
          Go to Student Portal
          <ArrowRight size={18} aria-hidden="true" />
        </ButtonLink>
      </section>
    </div>
  );
}
