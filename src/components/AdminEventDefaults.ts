import type { AuditEventFilters, AuditRetentionPolicy, SystemEventFilters, SystemEventRetentionPolicy } from "../types";

export const defaultAuditFilters: AuditEventFilters = {
  action: "",
  targetTable: "",
  actor: "",
  targetRecordId: "",
  dateFrom: "",
  dateTo: "",
  limit: 50,
};

export const defaultSystemEventFilters: SystemEventFilters = {
  eventType: "",
  severity: "",
  source: "",
  status: "",
  q: "",
  dateFrom: "",
  dateTo: "",
  limit: 50,
};

export const defaultAuditRetentionPolicy: AuditRetentionPolicy = {
  retentionDays: 2555,
  minimumProtectedDays: 365,
  batchSize: 5000,
  isEnabled: true,
  createdAt: "",
  updatedAt: "",
};

export const defaultSystemEventRetentionPolicy: SystemEventRetentionPolicy = {
  retentionDays: 365,
  minimumProtectedDays: 30,
  batchSize: 5000,
  isEnabled: true,
  createdAt: "",
  updatedAt: "",
};
