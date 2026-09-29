import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/design";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helperText?: string;
};

export function Input({ className, helperText, id, label, ...props }: InputProps) {
  const inputId = id ?? props.name;

  return (
    <label className="ui-field" htmlFor={inputId}>
      {label ? <span className="ui-field__label">{label}</span> : null}
      <input className={cn("ui-input", className)} id={inputId} {...props} />
      {helperText ? <span className="ui-field__helper">{helperText}</span> : null}
    </label>
  );
}
