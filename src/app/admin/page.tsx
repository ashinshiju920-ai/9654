import Link from "next/link";
import {
  CheckCircle2,
  FileText,
  FolderKanban,
  HelpCircle,
  History,
  TrendingUp,
  UploadCloud,
  Users,
} from "lucide-react";

import { getAdminStats } from "@/lib/admin/queries";
import { getRecentAuditLogs } from "@/lib/admin/audit";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [stats, auditLogs] = await Promise.all([
    getAdminStats(),
    getRecentAuditLogs(6),
  ]);

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <span className="admin-badge admin-badge--navy">System Overview</span>
          <h1 className="admin-page__title">Administrator Dashboard</h1>
          <p className="admin-page__subtitle">
            Manage courses, learning materials, question banks, and student access.
          </p>
        </div>

        <div className="admin-page__actions">
          <Link href="/admin/materials" className="admin-btn admin-btn--primary">
            <UploadCloud size={16} />
            <span>Upload PDF</span>
          </Link>
          <Link href="/admin/questions/import" className="admin-btn admin-btn--outline">
            <FileText size={16} />
            <span>Import Questions</span>
          </Link>
        </div>
      </header>

      {/* KPI Stats Grid */}
      <section className="admin-stats-grid" aria-label="Portal Metrics">
        <div className="admin-stat-card">
          <div className="admin-stat-card__icon admin-stat-card__icon--teal">
            <Users size={22} />
          </div>
          <div className="admin-stat-card__data">
            <span className="admin-stat-card__label">Total Students</span>
            <strong className="admin-stat-card__value">{stats.totalStudents}</strong>
            <span className="admin-stat-card__hint">
              <CheckCircle2 size={13} /> {stats.activeStudents} active accounts
            </span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-card__icon admin-stat-card__icon--navy">
            <FolderKanban size={22} />
          </div>
          <div className="admin-stat-card__data">
            <span className="admin-stat-card__label">Courses Active</span>
            <strong className="admin-stat-card__value">{stats.totalCourses}</strong>
            <span className="admin-stat-card__hint">IELTS, OET, PTE, German</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-card__icon admin-stat-card__icon--amber">
            <FileText size={22} />
          </div>
          <div className="admin-stat-card__data">
            <span className="admin-stat-card__label">Published Materials</span>
            <strong className="admin-stat-card__value">{stats.publishedMaterials}</strong>
            <span className="admin-stat-card__hint">Private R2-backed PDFs</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-card__icon admin-stat-card__icon--purple">
            <HelpCircle size={22} />
          </div>
          <div className="admin-stat-card__data">
            <span className="admin-stat-card__label">Question Bank</span>
            <strong className="admin-stat-card__value">{stats.totalQuestions}</strong>
            <span className="admin-stat-card__hint">Across all 4 courses</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-card__icon admin-stat-card__icon--green">
            <TrendingUp size={22} />
          </div>
          <div className="admin-stat-card__data">
            <span className="admin-stat-card__label">Quiz Attempts</span>
            <strong className="admin-stat-card__value">{stats.totalAttempts}</strong>
            <span className="admin-stat-card__hint">
              Avg score: {stats.averageQuizScore}%
            </span>
          </div>
        </div>
      </section>

      {/* Courses Overview & Quick Actions */}
      <div className="admin-split-grid">
        <section className="admin-card">
          <div className="admin-card__header">
            <div>
              <h2 className="admin-card__title">Course Content Summary</h2>
              <p className="admin-card__subtitle">Distribution of materials and questions</p>
            </div>
            <Link href="/admin/courses" className="admin-link">
              Manage courses →
            </Link>
          </div>

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Study PDFs</th>
                  <th>Questions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats.courseSummaries.map((course) => (
                  <tr key={course.id}>
                    <td>
                      <strong>{course.name}</strong>
                      <span className="admin-table__subtext">Slug: {course.slug}</span>
                    </td>
                    <td>{course.displayOrder}</td>
                    <td>
                      <span
                        className={`admin-status-pill ${
                          course.isActive ? "is-active" : "is-inactive"
                        }`}
                      >
                        {course.isActive ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td>{course.materialCount} PDFs</td>
                    <td>{course.questionCount} Questions</td>
                    <td>
                      <div className="admin-table-actions">
                        <Link
                          href={`/admin/materials?course=${course.slug}`}
                          className="admin-action-btn"
                          title="View Materials"
                        >
                          PDFs
                        </Link>
                        <Link
                          href={`/admin/questions?course=${course.slug}`}
                          className="admin-action-btn"
                          title="View Questions"
                        >
                          Questions
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Audit Log */}
        <section className="admin-card">
          <div className="admin-card__header">
            <div>
              <h2 className="admin-card__title">Recent Activity</h2>
              <p className="admin-card__subtitle">Administrative mutation audit trail</p>
            </div>
            <Link href="/admin/audit-logs" className="admin-link">
              View all →
            </Link>
          </div>

          <div className="admin-activity-list">
            {auditLogs.length === 0 ? (
              <div className="admin-empty-state">
                <History size={32} className="admin-empty-state__icon" />
                <p>No recent administrative activity recorded.</p>
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="admin-activity-item">
                  <div className="admin-activity-item__dot" />
                  <div className="admin-activity-item__content">
                    <div className="admin-activity-item__header">
                      <span className="admin-activity-item__action">{log.action}</span>
                      <time className="admin-activity-item__time">
                        {new Date(log.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                    {log.details && (
                      <p className="admin-activity-item__details">{log.details}</p>
                    )}
                    <span className="admin-activity-item__admin">
                      By: {log.adminEmail || "Administrator"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
