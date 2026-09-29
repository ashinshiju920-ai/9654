import type { ReactNode } from "react";
import { AlertCircle, FileQuestion } from "lucide-react";

import { ButtonLink } from "./button";

type StateProps = {
  actionHref?: string;
  actionLabel?: string;
  children?: ReactNode;
  message: string;
  title: string;
};

export function EmptyState({ actionHref, actionLabel, children, message, title }: StateProps) {
  return (
    <div className="ui-state">
      <FileQuestion size={28} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{message}</p>
      {children}
      {actionHref && actionLabel ? (
        <ButtonLink href={actionHref} size="sm" variant="secondary">
          {actionLabel}
        </ButtonLink>
      ) : null}
    </div>
  );
}

export function ErrorState({ actionHref, actionLabel, children, message, title }: StateProps) {
  return (
    <div className="ui-state ui-state--error">
      <AlertCircle size={28} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{message}</p>
      {children}
      {actionHref && actionLabel ? (
        <ButtonLink href={actionHref} size="sm" variant="secondary">
          {actionLabel}
        </ButtonLink>
      ) : null}
    </div>
  );
}
