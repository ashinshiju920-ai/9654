import { CreditCard } from "lucide-react";

import { requireAdminOrRedirect } from "@/lib/auth";
import { formatMoneyMinor, listAdminCommerce } from "@/lib/commerce/service";

export const dynamic = "force-dynamic";

export default async function AdminCommercePage() {
  await requireAdminOrRedirect("/login?next=/admin/commerce");
  const { products, orders, payments } = await listAdminCommerce();

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <span className="admin-badge admin-badge--navy">Commerce</span>
          <h1 className="admin-page__title">Products, Orders & Payments</h1>
          <p className="admin-page__subtitle">
            Inspect Cashfree-backed purchases without exposing payment credentials.
          </p>
        </div>
        <CreditCard size={26} aria-hidden="true" />
      </header>

      <section className="admin-card">
        <div className="admin-card__header">
          <div>
            <h2 className="admin-card__title">Products</h2>
            <p className="admin-card__subtitle">Price changes affect new orders only.</p>
          </div>
        </div>
        <CommerceTable
          headers={["Product", "Course", "Tier", "Price", "Status"]}
          rows={products.map((product) => [
            product.name,
            product.courseName,
            product.accessTier,
            formatMoneyMinor(product.priceAmountMinor, product.currency),
            product.active ? "Active" : "Inactive",
          ])}
        />
      </section>

      <section className="admin-card">
        <div className="admin-card__header">
          <div>
            <h2 className="admin-card__title">Recent Orders</h2>
            <p className="admin-card__subtitle">Internal order state and Cashfree reference.</p>
          </div>
        </div>
        <CommerceTable
          headers={["Customer", "Product", "Amount", "Status", "Provider order", "Created"]}
          rows={orders.map((order) => [
            order.userEmail,
            order.productName,
            formatMoneyMinor(order.amountMinor, order.currency),
            order.status,
            order.providerOrderId,
            new Date(order.createdAt).toLocaleString(),
          ])}
        />
      </section>

      <section className="admin-card">
        <div className="admin-card__header">
          <div>
            <h2 className="admin-card__title">Recent Payments</h2>
            <p className="admin-card__subtitle">Payment attempts retained for reconciliation.</p>
          </div>
        </div>
        <CommerceTable
          headers={["Customer", "Payment", "Amount", "Status", "Method", "Received"]}
          rows={payments.map((payment) => [
            payment.userEmail,
            payment.providerPaymentId,
            formatMoneyMinor(payment.amountMinor, payment.currency),
            payment.status,
            payment.paymentGroup || "Unknown",
            new Date(payment.receivedAt).toLocaleString(),
          ])}
        />
      </section>
    </div>
  );
}

function CommerceTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="admin-table-container">
      <table className="admin-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="admin-table__empty" colSpan={headers.length}>
                No records found.
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={`${row[0]}-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${cell}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
