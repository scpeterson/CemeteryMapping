import { toDefinition } from "./definitions.mjs";

export function compactText(value, maxLength = 250) {
  const text = String(value ?? "").trim().replace(/\s+/gu, " ");
  return text.slice(0, maxLength);
}

export function optionalTextParameter(parameters, name, maxLength = 250) {
  return compactText(parameters?.[name], maxLength);
}

export function requireTextParameter(parameters, name, label, maxLength = 250) {
  const text = optionalTextParameter(parameters, name, maxLength);
  if (!text) {
    const error = new Error(`${label} is required.`);
    error.code = "REPORT_PARAMETER_REQUIRED";
    throw error;
  }
  return text;
}

export function optionalPositiveIntegerParameter(parameters, name, max = 3650) {
  const text = optionalTextParameter(parameters, name, 20);
  if (!text) return undefined;
  const value = Number.parseInt(text, 10);
  if (!Number.isFinite(value) || value < 1 || value > max) {
    const error = new Error(`${name} must be between 1 and ${max}.`);
    error.code = "REPORT_PARAMETER_INVALID";
    throw error;
  }
  return value;
}

export function assignedCemeteryIds(user) {
  return Array.isArray(user?.cemeteryAccess) ? [...new Set(user.cemeteryAccess.map((assignment) => assignment.cemeteryId).filter(Boolean))] : [];
}

export function selectedAdminCemeteryId(parameters) {
  const cemeteryId = optionalTextParameter(parameters, "cemeteryId", 80);
  if (!cemeteryId || cemeteryId === "__all") return "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(cemeteryId)) {
    const error = new Error("Cemetery filter must be a UUID.");
    error.code = "REPORT_PARAMETER_INVALID";
    throw error;
  }
  return cemeteryId;
}

export function reportCemeteryIds(user) {
  if (user?.role === "admin") return undefined;
  return assignedCemeteryIds(user);
}

export function selectedReportCemeteryIds(user, parameters) {
  if (user?.role !== "admin") return reportCemeteryIds(user);
  const cemeteryId = selectedAdminCemeteryId(parameters);
  return cemeteryId ? [cemeteryId] : undefined;
}

export function scopedWhere(columnName, values, cemeteryIds) {
  if (!cemeteryIds) return "";
  if (cemeteryIds.length === 0) return " AND false";
  values.push(cemeteryIds);
  return ` AND ${columnName} = ANY($${values.length}::uuid[])`;
}

export function reportResult({ definition, summary, subtitle, columns, rows, notes = [], layout }) {
  return {
    report: toDefinition(definition),
    summary,
    ...(subtitle ? { subtitle } : {}),
    columns,
    rows,
    notes,
    generatedAt: new Date().toISOString(),
    ...(layout ? { layout } : {}),
  };
}
