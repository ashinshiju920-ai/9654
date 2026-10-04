import { Suspense } from "react";

import { EntitlementManager } from "./entitlement-manager";

export const metadata = {
  title: "Entitlements - Aylem Admin",
  description: "Manage course and Advanced Practice access entitlements",
};

export default function EntitlementsPage() {
  return (
    <div>
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--navy-900, #062a52)" }}>
          Student Entitlements
        </h1>
        <p style={{ color: "var(--slate-500, #64748b)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
          Grant and revoke course-scoped Standard and Advanced access. Manual grants use the ADMIN source.
        </p>
      </div>

      <Suspense fallback={<div className="admin-loading">Loading entitlements...</div>}>
        <EntitlementManager />
      </Suspense>
    </div>
  );
}
