import type { ButtonHTMLAttributes } from "react";
export function Button({ variant = "primary", busy = false, disabled, className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger"; busy?: boolean }) {
  return <button {...props} type={type} className={`ui-button ui-button--${variant} ${className}`} disabled={disabled || busy} aria-busy={busy || undefined} />;
}
