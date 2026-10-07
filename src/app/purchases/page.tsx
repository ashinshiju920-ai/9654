import Link from "next/link";

import { requireUserOrRedirect } from "@/lib/auth";
import { formatMoneyMinor, listPurchasesForUser } from "@/lib/commerce/service";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const user = await requireUserOrRedirect("/signup?next=/purchases");
  const purchases = await listPurchasesForUser(user);

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="page-kicker">Purchases</p>
          <h1 className="page-title">Purchase history</h1>
          <p className="page-subtitle">Your course purchases and payment states.</p>
        </div>
      </section>

      <section className="purchase-history-list">
        {purchases.length === 0 ? (
          <div className="payment-status-panel">
            <h2>No purchases yet</h2>
            <p>Unlocked course purchases will appear here.</p>
          </div>
        ) : (
          purchases.map((purchase) => (
            <article className="purchase-history-item" key={purchase.id}>
              <div>
                <h2>{purchase.productName}</h2>
                <p>
                  {purchase.courseName} · {purchase.accessTier}
                </p>
              </div>
              <div>
                <strong>{formatMoneyMinor(purchase.amountMinor, purchase.currency)}</strong>
                <span className={`admin-status-pill is-${purchase.status === "PAID" ? "active" : "inactive"}`}>
                  {purchase.status}
                </span>
              </div>
              <time>{new Date(purchase.createdAt).toLocaleString()}</time>
              {purchase.status === "PAID" && (
                <Link className="admin-action-btn" href={`/courses/${purchase.courseSlug}`}>
                  Open course
                </Link>
              )}
            </article>
          ))
        )}
      </section>
    </main>
  );
}
