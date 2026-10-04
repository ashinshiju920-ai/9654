import { Suspense } from "react";

import { AdvancedPracticeTabs } from "../advanced-tabs";
import { AdvancedCsvImporter } from "./advanced-csv-importer";

export const metadata = {
  title: "Advanced CSV Import - Aylem Admin",
  description: "Import Advanced Practice questions into a selected collection",
};

export default function AdvancedImportPage() {
  return (
    <div>
      <AdvancedPracticeTabs />
      <Suspense fallback={<div className="admin-loading">Loading Advanced CSV importer...</div>}>
        <AdvancedCsvImporter />
      </Suspense>
    </div>
  );
}
