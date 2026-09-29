import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/design";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type BaseButtonProps = {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
};

type ButtonProps = BaseButtonProps & ButtonHTMLAttributes<HTMLButtonElement>;

type ButtonLinkProps = BaseButtonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn("ui-button", `ui-button--${variant}`, `ui-button--${size}`, className)}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  className,
  variant = "primary",
  size = "md",
  href,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn("ui-button", `ui-button--${variant}`, `ui-button--${size}`, className)}
      href={href}
      {...props}
    >
      {children}
    </Link>
  );
}
