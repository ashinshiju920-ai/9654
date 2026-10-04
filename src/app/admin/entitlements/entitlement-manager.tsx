"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";

type StudentOption = { id: string; email: string; fullName: string | null };
type CourseOption = { id: string; slug: string; name: string };
type EntitlementRow = {
  id: string;
  userEmail: string;
  userName: string | null;
  courseName: string;
  courseSlug: string;
  accessTier: "STANDARD" | "ADVANCED";
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  source: string;
  grantedAt: string;
  expiresAt: string | null;
  externalReference: string | null;
};

export function EntitlementManager() {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [entitlements, setEntitlements] = useState<EntitlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    userId: "",
    courseId: "",
    accessTier: "STANDARD",
    expiresAt: "",
    externalReference: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/entitlements?${params.toString()}`);
      const data = (await res.json()) as {
        students?: StudentOption[];
        courses?: CourseOption[];
        entitlements?: EntitlementRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to load entitlements.");
      setStudents(data.students || []);
      setCourses(data.courses || []);
      setEntitlements(data.entitlements || []);
      setForm((prev) => ({
        ...prev,
        userId: prev.userId || data.students?.[0]?.id || "",
        courseId: prev.courseId || data.courses?.[0]?.id || "",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load entitlements.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  const grant = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/entitlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          source: "ADMIN",
          expiresAt: form.expiresAt || null,
          externalReference: form.externalReference || null,
        }),
      });
      const data = (await res.json()) as { error?: string; created?: boolean };
      if (!res.ok) throw new Error(data.error || "Failed to grant entitlement.");
      setMessage(data.created ? "Entitlement granted." : "Existing entitlement updated idempotently.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to grant entitlement.");
    } finally {
      setSubmitting(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this entitlement?")) return;
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/entitlements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to revoke entitlement.");
      setMessage("Entitlement revoked.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to revoke entitlement.");
    }
  };

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      {message && (
        <div className="admin-alert admin-alert-success">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="admin-alert admin-alert-error">
          <XCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <form className="admin-card" onSubmit={grant}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>
          Grant Course Entitlement
        </h2>
        <div className="admin-form-row">
          <div className="admin-form-group" style={{ flex: 2 }}>
            <label className="admin-label">Student</label>
            <select
              className="admin-select"
              required
              value={form.userId}
              onChange={(event) => setForm((prev) => ({ ...prev, userId: event.target.value }))}
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.email}{student.fullName ? ` (${student.fullName})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Course</label>
            <select
              className="admin-select"
              required
              value={form.courseId}
              onChange={(event) => setForm((prev) => ({ ...prev, courseId: event.target.value }))}
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Access Tier</label>
            <select
              className="admin-select"
              value={form.accessTier}
              onChange={(event) => setForm((prev) => ({ ...prev, accessTier: event.target.value }))}
            >
              <option value="STANDARD">STANDARD</option>
              <option value="ADVANCED">ADVANCED</option>
            </select>
          </div>
        </div>
        <div className="admin-form-row">
          <div className="admin-form-group">
            <label className="admin-label">Expiry</label>
            <input
              className="admin-input"
              type="date"
              value={form.expiresAt}
              onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
            />
          </div>
          <div className="admin-form-group" style={{ flex: 2 }}>
            <label className="admin-label">External Reference</label>
            <input
              className="admin-input"
              placeholder="Optional order/reference"
              value={form.externalReference}
              onChange={(event) => setForm((prev) => ({ ...prev, externalReference: event.target.value }))}
            />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="admin-btn admin-btn-primary" disabled={submitting} type="submit">
            <ShieldCheck size={16} />
            {submitting ? "Granting..." : "Grant Entitlement"}
          </button>
        </div>
      </form>

      <div className="admin-card">
        <div className="admin-actions-bar">
          <div className="admin-search-group">
            <input
              className="admin-input"
              placeholder="Search by student email or name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button className="admin-btn admin-btn-secondary" onClick={loadData} type="button">
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="admin-loading-state">Loading entitlements...</div>
        ) : entitlements.length === 0 ? (
          <div className="admin-empty-state">No entitlements found.</div>
        ) : (
          <div className="admin-table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Tier</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Expiry</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entitlements.map((entitlement) => (
                  <tr key={entitlement.id}>
                    <td>
                      <strong>{entitlement.userEmail}</strong>
                      {entitlement.userName && (
                        <div style={{ color: "var(--slate-500)", fontSize: "0.75rem" }}>
                          {entitlement.userName}
                        </div>
                      )}
                    </td>
                    <td>{entitlement.courseName}</td>
                    <td>
                      <span className="admin-badge admin-badge-neutral">{entitlement.accessTier}</span>
                    </td>
                    <td>
                      <span className={`admin-badge ${entitlement.status === "ACTIVE" ? "admin-badge-success" : "admin-badge-archived"}`}>
                        {entitlement.status}
                      </span>
                    </td>
                    <td>{entitlement.source}</td>
                    <td>{entitlement.expiresAt ? new Date(entitlement.expiresAt).toLocaleDateString() : "Lifetime"}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="admin-btn admin-btn-danger admin-btn-sm"
                        disabled={entitlement.status !== "ACTIVE"}
                        onClick={() => revoke(entitlement.id)}
                        type="button"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
