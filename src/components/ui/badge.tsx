import type { HTMLAttributes } from "react";

import { cn } from "@/lib/design";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "navy" | "teal" | "slate" | "danger" | "success" | "gold";
};

export function Badge({ className, tone = "slate", ...props }: BadgeProps) {
  return <span className={cn("ui-badge", `ui-badge--${tone}`, className)} {...props} />;
}
