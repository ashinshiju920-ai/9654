import { BarChart3 } from "lucide-react";

import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import { requireUserOrRedirect } from "@/lib/auth";
import { getUserQuizHistory } from "@/lib/db/quiz";

export default async function ResultsPage() {
  const user = await requireUserOrRedirect("/login");
  const history = await getUserQuizHistory(user.id).catch(() => []);

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="page-kicker">My Results</p>
          <h1 className="page-title">Results</h1>
          <p className="page-subtitle">
            Quiz history and scoring summaries for your practice attempts.
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
          {history.length === 0 ? (
            <EmptyState
              title="No results yet"
              message="Completed quiz attempts will appear here with course, score and date."
            />
          ) : (
            <div className="history-list">
              {history.map((attempt) => (
                <div
                  key={attempt.id}
                  className="history-row"
                  style={{
                    padding: "0.75rem 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong>{attempt.courseName}</strong> ({attempt.testSize} questions)
                      <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                        {new Date(attempt.startedAt).toLocaleDateString()} &bull; Status:{" "}
                        {attempt.status}
                      </div>
                    </div>
                    {attempt.score !== null ? (
                      <span className="badge badge--success">
                        {attempt.score} / {attempt.testSize}
                      </span>
                    ) : (
                      <span className="badge badge--muted">In progress</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
