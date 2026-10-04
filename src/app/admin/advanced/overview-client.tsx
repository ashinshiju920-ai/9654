"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  FileSpreadsheet,
  FolderTree,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { AdvancedHealthSummary } from "@/lib/admin/advanced-practice";

const courseColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  ielts: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", badge: "#3b82f6" },
  oet: { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d", badge: "#10b981" },
  pte: { bg: "#faf5ff", border: "#e9d5ff", text: "#7e22ce", badge: "#8b5cf6" },
  german: { bg: "#fffbeb", border: "#fde68a", text: "#b45309", badge: "#f59e0b" },
};

export function AdvancedOverviewClient() {
  const [data, setData] = useState<AdvancedHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/advanced/stats");
      if (!res.ok) {
        throw new Error(`Failed to load Advanced Practice statistics (${res.status})`);
      }
      const json = (await res.json()) as AdvancedHealthSummary;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(fetchStats);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Quick Action Ribbon */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
          color: "#ffffff",
          padding: "1.25rem 1.5rem",
          borderRadius: "0.75rem",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <Sparkles size={16} color="#c084fc" />
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "#ffffff" }}>
              Advanced Practice Dashboard
            </h2>
          </div>
          <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.875rem" }}>
            Live, real-time database counts across all Advanced Practice collections and question banks.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={fetchStats}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.5rem 0.875rem",
              borderRadius: "0.375rem",
              background: "rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "0.8125rem",
              fontWeight: 500,
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <Link
            href="/admin/advanced/collections"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.5rem 0.875rem",
              borderRadius: "0.375rem",
              background: "rgba(255, 255, 255, 0.15)",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <FolderTree size={14} />
            <span>Manage Collections</span>
          </Link>

          <Link
            href="/admin/advanced/import"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              background: "#9333ea",
              color: "#ffffff",
              fontSize: "0.8125rem",
              fontWeight: 600,
              textDecoration: "none",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          >
            <FileSpreadsheet size={14} />
            <span>Import Questions</span>
          </Link>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "1rem",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "0.5rem",
            color: "#991b1b",
            fontSize: "0.875rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Global Advanced Totals */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            padding: "1.25rem",
            borderRadius: "0.5rem",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
            Total Collections
          </span>
          <div style={{ fontSize: "1.875rem", fontWeight: 700, color: "#0f172a", marginTop: "0.25rem" }}>
            {loading ? "..." : data?.totalCollections ?? 0}
          </div>
          <span style={{ fontSize: "0.8125rem", color: "#10b981", marginTop: "0.25rem", display: "inline-block" }}>
            {data?.publishedCollections ?? 0} published
          </span>
        </div>

        <div
          style={{
            background: "#ffffff",
            padding: "1.25rem",
            borderRadius: "0.5rem",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
            Total Advanced Questions
          </span>
          <div style={{ fontSize: "1.875rem", fontWeight: 700, color: "#7c3aed", marginTop: "0.25rem" }}>
            {loading ? "..." : data?.totalQuestions ?? 0}
          </div>
          <span style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem", display: "inline-block" }}>
            {data?.activeQuestions ?? 0} active
          </span>
        </div>

        <div
          style={{
            background: "#ffffff",
            padding: "1.25rem",
            borderRadius: "0.5rem",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
            Isolated Exam Tracks
          </span>
          <div style={{ fontSize: "1.875rem", fontWeight: 700, color: "#0369a1", marginTop: "0.25rem" }}>
            4
          </div>
          <span style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem", display: "inline-block" }}>
            IELTS, OET, PTE, German
          </span>
        </div>

        <div
          style={{
            background: "#ffffff",
            padding: "1.25rem",
            borderRadius: "0.5rem",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
            Admin Preview Mode
          </span>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#16a34a", marginTop: "0.375rem" }}>
            Enabled
          </div>
          <span style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem", display: "inline-block" }}>
            Direct testing enabled for admins
          </span>
        </div>
      </div>

      {/* Per-Course Advanced Health Grid */}
      <div>
        <h3
          style={{
            fontSize: "1.125rem",
            fontWeight: 700,
            color: "var(--navy-900, #062a52)",
            marginBottom: "0.875rem",
          }}
        >
          Question Bank Health Per Course
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {(data?.courses || []).map((c) => {
            const colors = courseColors[c.courseSlug] || {
              bg: "#f8fafc",
              border: "#e2e8f0",
              text: "#334155",
              badge: "#64748b",
            };

            return (
              <div
                key={c.courseSlug}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.625rem",
                  padding: "1.25rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "1rem",
                    }}
                  >
                    <span
                      style={{
                        padding: "0.25rem 0.5rem",
                        borderRadius: "0.375rem",
                        background: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      {c.courseSlug}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      {c.publishedCollections} active collections
                    </span>
                  </div>

                  <h4 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.75rem 0" }}>
                    {c.courseName}
                  </h4>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.5rem 0.75rem",
                        background: "#f8fafc",
                        borderRadius: "0.375rem",
                        fontSize: "0.8125rem",
                      }}
                    >
                      <span style={{ color: "#64748b" }}>Advanced Collections:</span>
                      <strong style={{ color: "#0f172a" }}>{c.totalCollections}</strong>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.5rem 0.75rem",
                        background: "#f8fafc",
                        borderRadius: "0.375rem",
                        fontSize: "0.8125rem",
                      }}
                    >
                      <span style={{ color: "#64748b" }}>Advanced Questions:</span>
                      <strong style={{ color: c.totalQuestions > 0 ? "#7c3aed" : "#94a3b8" }}>
                        {c.totalQuestions}
                      </strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <Link
                    href={`/admin/advanced/collections?course=${c.courseSlug}`}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "0.4375rem 0.5rem",
                      borderRadius: "0.375rem",
                      background: "#f1f5f9",
                      color: "#334155",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    View Collections
                  </Link>

                  <Link
                    href={`/admin/advanced/import?course=${c.courseSlug}`}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "0.4375rem 0.5rem",
                      borderRadius: "0.375rem",
                      background: "#ede9fe",
                      color: "#6d28d9",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Import CSV
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Architectural Separation Notice */}
      <div
        style={{
          background: "#faf5ff",
          border: "1px solid #e9d5ff",
          borderRadius: "0.625rem",
          padding: "1.25rem 1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
          <Sparkles size={20} color="#7c3aed" style={{ flexShrink: 0, marginTop: "0.125rem" }} />
          <div>
            <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#581c87", margin: "0 0 0.25rem 0" }}>
              Standard / Advanced Strict Isolation Architecture
            </h4>
            <p style={{ fontSize: "0.8125rem", color: "#6b21a8", margin: 0, lineHeight: 1.5 }}>
              Standard Question Banks (e.g. 400 IELTS standard questions) and Advanced Practice collections operate in completely disjoint database tables (`questions` vs `advanced_questions`). Standard 20/50/100 mock tests never pull questions from Advanced collections, and Advanced Practice tests draw exclusively from their assigned collection.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
