import { BarChart3 } from "lucide-react";

import { Badge, Card, CardBody, CardHeader, EmptyState, Skeleton } from "@/components/ui";

export default function ResultsPage() {
  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="page-kicker">My Results</p>
          <h1 className="page-title">Results</h1>
          <p className="page-subtitle">
            Quiz history and scoring summaries will be shown after Supabase attempt storage is
            wired.
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <div>
            <Badge tone="navy">History</Badge>
            <h2>Attempt history</h2>
          </div>
          <BarChart3 size={22} color="#0AA69A" aria-hidden="true" />
        </CardHeader>
        <CardBody>
          <EmptyState
            title="No results yet"
            message="Completed quiz attempts will appear here with course, score and date."
          />
          <Skeleton className="results-skeleton" />
        </CardBody>
      </Card>
    </div>
  );
}
