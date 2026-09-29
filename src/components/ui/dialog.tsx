import type { HTMLAttributes, ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "./button";

type DialogProps = HTMLAttributes<HTMLDivElement> & {
  description?: string;
  open?: boolean;
  title: string;
  children: ReactNode;
};

export function Dialog({ children, description, open = false, title, ...props }: DialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div aria-modal="true" className="ui-dialog-backdrop" role="dialog" {...props}>
      <div className="ui-dialog">
        <div className="ui-dialog__header">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <Button aria-label="Close dialog" size="sm" variant="ghost">
            <X size={18} aria-hidden="true" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
