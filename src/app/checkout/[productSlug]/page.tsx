import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { getCurrentSession } from "@/lib/auth/session";
import {
  formatMoneyMinor,
  getActiveProduct,
} from "@/lib/commerce/service";
import { canUserAccessCourse, type AccessTier } from "@/lib/entitlements";
import { CheckoutHandoffAction } from "./checkout-handoff-action";

export const dynamic = "force-dynamic";

type CheckoutPageProps = {
  params: Promise<{
    productSlug: string;
  }>;
};

export default async function CheckoutProductPage({ params }: CheckoutPageProps) {
  const { productSlug: rawSlug } = await params;
  const productSlug = rawSlug?.trim().toLowerCase();

  if (!productSlug) {
    notFound();
  }

  // 1. Authoritative product validation from DB
  const product = await getActiveProduct({ productSlug });
  if (!product) {
    return (
      <main className="page checkout-handoff-page">
        <section className="page-header">
          <div>
            <p className="page-kicker">Checkout</p>
            <h1 className="page-title">Product Unavailable</h1>
            <p className="page-subtitle">
              The requested course product is not currently available in our catalogue.
            </p>
          </div>
        </section>
        <div className="payment-status-panel">
          <AlertCircle size={32} aria-hidden="true" />
          <div>
            <h2>Product Not Found</h2>
            <p>Please return to the courses list to choose an available product.</p>
          </div>
        </div>
        <div className="payment-return-actions">
          <Link className="dashboard-commercial-btn" href="/courses">
            <span>Explore Courses</span>
          </Link>
          <Link className="dashboard-commercial-btn dashboard-commercial-btn--secondary" href="/dashboard">
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </main>
    );
  }

  // 2. Authentication check: must belong to a known portal user
  const session = await getCurrentSession();
  if (!session) {
    // Preserve product slug in redirect to resume post-login
    redirect(`/login?next=${encodeURIComponent(`/checkout/${productSlug}`)}`);
  }

  const user = session.user;

  // 3. Already-owned entitlement check
  const alreadyOwned = await canUserAccessCourse(
    user,
    product.courseId,
    product.accessTier as AccessTier,
  );

  if (alreadyOwned) {
    return (
      <main className="page checkout-handoff-page">
        <section className="page-header">
          <div>
            <p className="page-kicker">Course Entitlement</p>
            <h1 className="page-title">You already have access</h1>
            <p className="page-subtitle">
              Your account is already active for {product.courseName} {product.accessTier.toLowerCase()} practice.
            </p>
          </div>
        </section>

        <section className="payment-status-panel">
          <CheckCircle2 size={32} aria-hidden="true" style={{ color: "var(--oet, #10b981)" }} />
          <div>
            <h2>You already have access to this course.</h2>
            <p>
              No additional payment is needed. You have full access to {product.courseName} questions, mock tests, and practice materials.
            </p>
          </div>
        </section>

        <div className="payment-return-actions">
          <Link className="dashboard-commercial-btn" href={`/courses/${product.courseSlug}/quiz`}>
            <span>Open Advanced Practice</span>
          </Link>
          <Link className="dashboard-commercial-btn dashboard-commercial-btn--secondary" href={`/courses/${product.courseSlug}`}>
            <span>View {product.courseName} Hub</span>
          </Link>
          <Link className="dashboard-commercial-btn dashboard-commercial-btn--secondary" href="/dashboard">
            <span>Go to Dashboard</span>
          </Link>
        </div>
      </main>
    );
  }

  const formattedPrice = formatMoneyMinor(product.priceAmountMinor, product.currency);

  return (
    <main className="page checkout-handoff-page">
      <section className="page-header">
        <div>
          <p className="page-kicker">Secure Enrollment</p>
          <h1 className="page-title">Unlock {product.name}</h1>
          <p className="page-subtitle">
            Complete your enrollment to unlock comprehensive practice materials for {product.courseName}.
          </p>
        </div>
      </section>

      <div className="checkout-summary-grid">
        {/* Left: Product & Entitlement Scope */}
        <section className="checkout-details-card">
          <div className="checkout-details-card__header">
            <span className="checkout-pill">
              <Sparkles size={13} aria-hidden="true" />
              {product.accessTier} Tier
            </span>
            <h2>{product.courseName}</h2>
          </div>

          <p className="checkout-details-card__desc">
            {product.description ||
              `Instant access to official ${product.courseName} Advanced practice materials, full-length timed mock tests, and detailed answer explanations.`}
          </p>

          <ul className="checkout-benefits-list">
            <li>
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>Full Computer-Adaptive Question Pool</span>
            </li>
            <li>
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>Timed Full-Length Mock Exams with Instant Scoring</span>
            </li>
            <li>
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>Verified Answer Keys & Sub-test Review</span>
            </li>
            <li>
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>Official Study Handouts & Strategy Guides</span>
            </li>
          </ul>

          <div className="checkout-account-box">
            <div className="checkout-account-box__row">
              <span className="checkout-account-box__label">Enrolling as:</span>
              <span className="checkout-account-box__val">{user.fullName || user.email}</span>
            </div>
            <div className="checkout-account-box__row">
              <span className="checkout-account-box__label">Portal Account:</span>
              <span className="checkout-account-box__val">{user.email}</span>
            </div>
          </div>
        </section>

        {/* Right: Payment Card with Server-Authoritative Price */}
        <section className="checkout-pay-card">
          <div className="checkout-pay-card__price-box">
            <span className="checkout-pay-card__label">Total Enrollment Fee</span>
            <div className="checkout-pay-card__amount">
              <span className="checkout-pay-card__price">{formattedPrice}</span>
              <span className="checkout-pay-card__period">One-time payment</span>
            </div>
            <small className="checkout-pay-card__note">
              Database authoritative price • No recurring charges
            </small>
          </div>

          <div className="checkout-pay-card__actions">
            <CheckoutHandoffAction
              productSlug={product.slug}
              formattedPrice={formattedPrice}
              productName={product.name}
            />
          </div>

          <div className="checkout-trust-badges">
            <div className="checkout-trust-badge">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>256-Bit SSL Encrypted</span>
            </div>
            <div className="checkout-trust-badge">
              <Zap size={16} aria-hidden="true" />
              <span>Instant Automated Access</span>
            </div>
            <div className="checkout-trust-badge">
              <Lock size={16} aria-hidden="true" />
              <span>Cashfree PG Secured</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
