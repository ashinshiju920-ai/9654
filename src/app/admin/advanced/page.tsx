import { Suspense } from "react";
import { AdvancedPracticeTabs } from "./advanced-tabs";
import { AdvancedOverviewClient } from "./overview-client";

export const metadata = {
  title: "Advanced Practice Overview - Aylem Admin",
  description: "Advanced Practice question bank health and collections overview",
};

export default function AdvancedOverviewPage() {
  return (
    <div>
      <AdvancedPracticeTabs />
      <Suspense fallback={<div className="admin-loading">Loading Advanced Practice health overview...</div>}>
        <AdvancedOverviewClient />
      </Suspense>
    </div>
  );
}
