"use client";

import {
  BarChart3,
  BookOpen,
  CircleHelp,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/design";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/courses/ielts", label: "IELTS", icon: BookOpen },
  { href: "/courses/oet", label: "OET", icon: BookOpen },
  { href: "/courses/pte", label: "PTE", icon: BookOpen },
  { href: "/courses/german", label: "German", icon: BookOpen },
  { href: "/results", label: "My Results", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/support", label: "Help & Support", icon: CircleHelp },
  { href: "/logout", label: "Logout", icon: LogOut },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicScreen =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/thank-you";

  if (isPublicScreen) {
    return <main className="public-shell">{children}</main>;
  }

  if (pathname.startsWith("/admin")) {
    return <div className="admin-root">{children}</div>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <Link className="sidebar__brand" href="/">
          <span className="sidebar__brand-mark">A</span>
          <span>
            <strong>Aylem</strong>
            <small>Learning</small>
          </span>
        </Link>

        <nav className="sidebar__nav">
          {navItems.map((item) => (
            <ShellLink active={isActive(pathname, item.href)} key={item.href} {...item} />
          ))}
        </nav>

        <div className="sidebar__motto">
          <GraduationCap size={20} aria-hidden="true" />
          <span>Learn. Practice. Achieve.</span>
        </div>
      </aside>

      <div className="mobile-topbar">
        <Link className="mobile-brand" href="/">
          Aylem <span>Learning</span>
        </Link>
        <button className="mobile-icon-button" type="button" aria-label="Open navigation">
          <Menu size={22} aria-hidden="true" />
        </button>
      </div>

      <main className="app-main">{children}</main>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navItems.slice(0, 7).map((item) => (
          <ShellLink active={isActive(pathname, item.href)} compact key={item.href} {...item} />
        ))}
      </nav>
    </div>
  );
}

type ShellLinkProps = (typeof navItems)[number] & {
  active: boolean;
  compact?: boolean;
};

function ShellLink({ active, compact = false, href, icon: Icon, label }: ShellLinkProps) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(compact ? "bottom-nav__link" : "sidebar__link", active && "is-active")}
      href={href}
    >
      <Icon size={compact ? 19 : 18} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
