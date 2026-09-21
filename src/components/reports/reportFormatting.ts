export function formatReportValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/u.test(value)) return value.slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value)) return value;
  return String(value);
}

