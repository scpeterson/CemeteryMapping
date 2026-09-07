import type { ReactNode } from "react";
export function Notice({ children, tone = "info", className = "" }: { children: ReactNode; tone?: "info" | "error" | "success"; className?: string }) {
  return <div className={`ui-notice ui-notice--${tone} ${className}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="ui-empty-state"><strong>{title}</strong>{children ? <p>{children}</p> : null}</div>;
}
export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" }) {
  return <span className={`ui-status-badge ui-status-badge--${tone}`}>{children}</span>;
}
