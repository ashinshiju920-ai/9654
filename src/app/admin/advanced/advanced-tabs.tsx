"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileSpreadsheet,
  FolderTree,
  HelpCircle,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";

const tabs = [
  { href: "/admin/advanced", label: "Overview & Health", icon: LayoutDashboard, exact: true },
  { href: "/admin/advanced/collections", label: "Collections", icon: FolderTree },
  { href: "/admin/advanced/questions", label: "Questions", icon: HelpCircle },
  { href: "/admin/advanced/import", label: "CSV Import", icon: FileSpreadsheet },
];

export function AdvancedPracticeTabs() {
  const pathname = usePathname();

  return (
    <div style={{ marginBottom: "2rem" }}>
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.25rem 0.625rem",
              borderRadius: "9999px",
              background: "rgba(124, 58, 237, 0.1)",
              border: "1px solid rgba(124, 58, 237, 0.25)",
              color: "#6d28d9",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginBottom: "0.5rem",
            }}
          >
            <Sparkles size={13} aria-hidden="true" />
            <span>ADVANCED PRACTICE ARCHITECTURE</span>
          </div>

          <h1
            style={{
              fontSize: "1.625rem",
              fontWeight: 700,
              color: "var(--navy-900, #062a52)",
              letterSpacing: "-0.015em",
              margin: 0,
            }}
          >
            Advanced Practice Management
          </h1>

          <p
            style={{
              color: "var(--slate-500, #64748b)",
              fontSize: "0.875rem",
              marginTop: "0.375rem",
              maxWidth: "48rem",
            }}
          >
            Manage multi-tier Advanced Practice collections, exam-pattern question pools, and authoritative CSV imports for IELTS, OET, PTE, and German. Content here is completely isolated from the Standard Question Bank.
          </p>
        </div>

        <div
          style={{
            padding: "0.5rem 0.875rem",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "0.5rem",
            fontSize: "0.8125rem",
            color: "#475569",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#10b981",
              display: "inline-block",
            }}
          />
          <span>Isolated Content Pool</span>
        </div>
      </div>

      {/* Tabs */}
      <nav
        aria-label="Advanced Practice Navigation"
        style={{
          display: "flex",
          gap: "0.5rem",
          borderBottom: "1px solid #e2e8f0",
          paddingBottom: "0.125rem",
          overflowX: "auto",
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.625rem 1rem",
                borderRadius: "0.375rem 0.375rem 0 0",
                fontSize: "0.875rem",
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#6d28d9" : "#64748b",
                borderBottom: isActive ? "2px solid #6d28d9" : "2px solid transparent",
                background: isActive ? "rgba(124, 58, 237, 0.04)" : "transparent",
                textDecoration: "none",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
