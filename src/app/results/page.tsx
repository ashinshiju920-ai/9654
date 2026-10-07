import Link from "next/link";
import { Award, BarChart3, Calendar, CheckCircle2, Clock, Layers } from "lucide-react";

import { AdvancedPostResultPromo } from "@/components/commercial/advanced-post-result-promo";
import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import { requireUserOrRedirect } from "@/lib/auth";
import type { CourseSlug } from "@/lib/courses";
import { getUserQuizHistory } from "@/lib/db/quiz";

type ResultsPageProps = {
  searchParams?: Promise<{
    course?: string;
    attemptId?: string;
  }>;
};

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const user = await requireUserOrRedirect("/signup?next=/results");
  const history = await getUserQuizHistory(user.id).catch(() => []);

  const resolvedParams = searchParams ? await searchParams : {};
  
  // Find course context from query param, or latest completed attempt in history
  let activeCourseSlug: CourseSlug | undefined;
  let activeCourseName: string | undefined;

  if (resolvedParams.course && ["ielts", "oet", "pte", "german"].includes(resolvedParams.course)) {
    activeCourseSlug = resolvedParams.course as CourseSlug;
    activeCourseName = resolvedParams.course.toUpperCase();
  } else if (history.length > 0 && history[0].courseSlug) {
    activeCourseSlug = history[0].courseSlug as CourseSlug;
    activeCourseName = history[0].courseName;
  }

  // Summary metrics for completed tests
  const completedAttempts = history.filter((a) => a.score !== null);
  const totalCompleted = completedAttempts.length;
  const avgPercentage =
    totalCompleted > 0
      ? (
          completedAttempts.reduce(
            (sum, a) => sum + (a.percentage ? parseFloat(a.percentage) : (a.score! / a.testSize) * 100),
            0,
          ) / totalCompleted
        ).toFixed(1)
      : null;

  return (
    <div className="page results-page">
      {/* 1. PRIMARY RESULT & HISTORY CONTENT */}
      <section className="page-header results-page-header">
        <div>
          <p className="page-kicker">Performance Summary</p>
          <h1 className="page-title">Mock Test Results</h1>
          <p className="page-subtitle">
            Review your standard mock test scores, verified question attempts, and progress history.
          </p>
        </div>

        {totalCompleted > 0 && (
          <div className="results-quick-stats">
            <div className="result-metric-card">
              <span className="result-metric-card__label">
                <CheckCircle2 size={14} color="#0aa69a" aria-hidden="true" />
                Completed Tests
              </span>
              <strong className="result-metric-card__value">{totalCompleted}</strong>
            </div>
            {avgPercentage && (
              <div className="result-metric-card">
                <span className="result-metric-card__label">
                  <Award size={14} color="#0aa69a" aria-hidden="true" />
                  Average Accuracy
                </span>
                <strong className="result-metric-card__value">{avgPercentage}%</strong>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2. ATTEMPT HISTORY CARD (PRIMARY CONTENT FIRST) */}
      <Card className="results-history-card">
        <CardHeader>
          <div>
            <Badge tone="navy">Standard Mock Tests</Badge>
            <h2>Attempt History</h2>
            <p>Full breakdown of test sizing, scores, and completion timestamps.</p>
          </div>
          <BarChart3 size={24} color="#0AA69A" aria-hidden="true" />
        </CardHeader>
        <CardBody>
          {history.length === 0 ? (
            <EmptyState
              actionHref="/courses"
              actionLabel="Browse Courses & Take a Test"
              message="When you complete a Standard Mock Test, your scores, test size, and question review summaries will appear here."
              title="No test results recorded yet"
            />
          ) : (
            <div className="history-list">
              {history.map((attempt) => {
                const isPassed =
                  attempt.score !== null &&
                  attempt.testSize > 0 &&
                  (attempt.score / attempt.testSize) >= 0.7;

                return (
                  <div className="history-row" key={attempt.id}>
                    <div className="history-row__main">
                      <div className="history-row__title-group">
                        <strong className="history-row__course">{attempt.courseName}</strong>
                        <span className="history-row__size-badge">
                          <Layers size={12} aria-hidden="true" />
                          {attempt.testSize} Questions
                        </span>
                      </div>
                      
                      <div className="history-row__meta">
                        <span className="history-row__meta-item">
                          <Calendar size={12} aria-hidden="true" />
                          {new Date(attempt.startedAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="history-row__meta-item">
                          <Clock size={12} aria-hidden="true" />
                          Status: <span className="capitalize">{attempt.status.replace("_", " ")}</span>
                        </span>
                      </div>
                    </div>

                    <div className="history-row__score-col">
                      {attempt.score !== null ? (
                        <div className="history-score-display" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.2rem" }}>
                              <span
                                className={`badge ${isPassed ? "badge--success" : "badge--warning"}`}
                                style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem" }}
                              >
                                {isPassed ? "Practice Benchmark Reached" : "Needs More Preparation"}
                              </span>
                            </div>
                            <span style={{ fontSize: "0.75rem", color: "var(--slate-500)" }}>
                              Score: {attempt.score} / {attempt.testSize}
                            </span>
                            {attempt.percentage && (
                              <span className="history-score-display__pct" style={{ marginLeft: "0.4rem" }}>
                                {parseFloat(attempt.percentage).toFixed(0)}%
                              </span>
                            )}
                          </div>
                          <Link
                            href={`/courses/${attempt.courseSlug}/quiz?attemptId=${attempt.id}`}
                            className="button button--secondary button--sm"
                            style={{ fontSize: "0.75rem", padding: "0.35rem 0.65rem" }}
                          >
                            Review
                          </Link>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span className="badge badge--muted">In progress</span>
                          <Link
                            href={`/courses/${attempt.courseSlug}/quiz?attemptId=${attempt.id}`}
                            className="button button--primary button--sm"
                            style={{ fontSize: "0.75rem", padding: "0.35rem 0.65rem" }}
                          >
                            Resume
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 3. POST-RESULT COURSE-AWARE ADVANCED PRACTICE CONVERSION SECTION */}
      {/* Placed STRICTLY underneath the primary result content */}
      <AdvancedPostResultPromo
        courseName={activeCourseName}
        courseSlug={activeCourseSlug}
        hasAttempts={history.length > 0}
        percentage={avgPercentage ? parseFloat(avgPercentage) : undefined}
      />
    </div>
  );
}
