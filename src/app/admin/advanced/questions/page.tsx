import { Suspense } from "react";

import { AdvancedPracticeTabs } from "../advanced-tabs";
import { AdvancedQuestionsClient } from "./advanced-questions-client";

export const metadata = {
  title: "Advanced Questions - Aylem Admin",
  description: "Manage Advanced Practice questions",
};

export default function AdvancedQuestionsPage() {
  return (
    <div>
      <AdvancedPracticeTabs />
      <Suspense fallback={<div className="admin-loading">Loading Advanced questions...</div>}>
        <AdvancedQuestionsClient />
      </Suspense>
    </div>
  );
}
