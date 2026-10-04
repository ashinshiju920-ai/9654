import { Suspense } from "react";

import { AdvancedPracticeTabs } from "../advanced-tabs";
import { AdvancedCollectionsClient } from "./advanced-collections-client";

export const metadata = {
  title: "Advanced Collections - Aylem Admin",
  description: "Manage Advanced Practice collections",
};

export default function AdvancedCollectionsPage() {
  return (
    <div>
      <AdvancedPracticeTabs />
      <Suspense fallback={<div className="admin-loading">Loading Advanced collections...</div>}>
        <AdvancedCollectionsClient />
      </Suspense>
    </div>
  );
}
