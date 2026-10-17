import { useId, type InputHTMLAttributes } from "react";
export function TextField({ label, hint, error, className = "", id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return <div className={`ui-field ${className}`}>
    <label htmlFor={fieldId}>{label}</label>
    <input {...props} id={fieldId} aria-invalid={Boolean(error) || undefined} aria-describedby={error || hint ? `${fieldId}-help` : undefined} />
    {error || hint ? <span id={`${fieldId}-help`} className={error ? "ui-field-error" : "muted"}>{error || hint}</span> : null}
  </div>;
}
