import type { ReactNode } from "react";

import { requireAdminOrRedirect } from "@/lib/auth";
import { AdminNav } from "./admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminOrRedirect("/signup?next=/admin");

  return (
    <div className="admin-layout">
      <AdminNav userEmail={user.email} />
      <main className="admin-main">
        <div className="admin-container">{children}</div>
      </main>
    </div>
  );
}
