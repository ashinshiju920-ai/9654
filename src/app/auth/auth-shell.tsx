import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";

type AuthShellProps = {
  children: ReactNode;
  kicker: string;
  subtitle: string;
  title: string;
};

export function AuthShell({ children, kicker, subtitle, title }: AuthShellProps) {
  return (
    <div className="auth-page">
      <section className="auth-card auth-card--login">
        <div className="auth-brand-panel">
          <BrandLogo className="auth-logo" />
          <h1>
            Learn
            <br />
            Practice
            <br />
            Achieve
          </h1>
          <p>Your Learning Journey Starts Here.</p>
          <span className="auth-leaf auth-leaf--teal" aria-hidden="true" />
        </div>

        <div className="auth-form-panel">
          <p className="page-kicker">{kicker}</p>
          <h2>{title}</h2>
          <p>{subtitle}</p>
          {children}
        </div>
      </section>
    </div>
  );
}
