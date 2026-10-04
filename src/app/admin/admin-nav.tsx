"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  FolderKanban,
  GraduationCap,
  CreditCard,
  HelpCircle,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  KeyRound,
  Users,
  X,
} from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/design";

const adminNavItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/courses", label: "Courses", icon: FolderKanban },
  { href: "/admin/materials", label: "Study Materials", icon: FileText },
  { href: "/admin/questions", label: "Standard Questions", icon: HelpCircle },
  { href: "/admin/questions/import", label: "Standard CSV Import", icon: UploadCloud },
  { href: "/admin/advanced", label: "Advanced Practice", icon: Sparkles },
  { href: "/admin/entitlements", label: "Entitlements", icon: KeyRound },
  { href: "/admin/commerce", label: "Commerce", icon: CreditCard },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: History },
];

export function AdminNav({
  userEmail,
}: {
  userEmail: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="admin-sidebar" aria-label="Admin Navigation">
        <div className="admin-sidebar__header">
          <Link className="admin-sidebar__brand" href="/admin">
            <BrandLogo admin />
          </Link>
        </div>

        <div className="admin-sidebar__user">
          <div className="admin-sidebar__user-avatar">
            <ShieldCheck size={18} aria-hidden="true" />
          </div>
          <div className="admin-sidebar__user-meta">
            <span className="admin-sidebar__user-role">Administrator</span>
            <span className="admin-sidebar__user-email" title={userEmail}>
              {userEmail}
            </span>
          </div>
        </div>

        <nav className="admin-sidebar__nav">
          {adminNavItems.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={cn("admin-sidebar__link", active && "is-active")}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="admin-sidebar__footer">
          <Link href="/dashboard" className="admin-sidebar__footer-link">
            <GraduationCap size={18} aria-hidden="true" />
            <span>Student Portal</span>
          </Link>
          <Link href="/logout" className="admin-sidebar__footer-link is-logout">
            <LogOut size={18} aria-hidden="true" />
            <span>Sign Out</span>
          </Link>
        </div>
      </aside>

      {/* Mobile Topbar */}
      <header className="admin-mobile-header">
        <Link className="admin-mobile-brand" href="/admin">
          <BrandLogo admin compact />
        </Link>

        <button
          type="button"
          className="admin-mobile-toggle"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="admin-mobile-drawer" onClick={() => setMobileOpen(false)}>
          <div className="admin-mobile-drawer__content" onClick={(e) => e.stopPropagation()}>
            <div className="admin-sidebar__user">
              <div className="admin-sidebar__user-avatar">
                <ShieldCheck size={18} aria-hidden="true" />
              </div>
              <div className="admin-sidebar__user-meta">
                <span className="admin-sidebar__user-role">Administrator</span>
                <span className="admin-sidebar__user-email">{userEmail}</span>
              </div>
            </div>

            <nav className="admin-mobile-nav">
              {adminNavItems.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    onClick={() => setMobileOpen(false)}
                    className={cn("admin-sidebar__link", active && "is-active")}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="admin-sidebar__footer">
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="admin-sidebar__footer-link"
              >
                <GraduationCap size={18} aria-hidden="true" />
                <span>Student Portal</span>
              </Link>
              <Link
                href="/logout"
                onClick={() => setMobileOpen(false)}
                className="admin-sidebar__footer-link is-logout"
              >
                <LogOut size={18} aria-hidden="true" />
                <span>Sign Out</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
