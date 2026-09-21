export type AuditRetentionPolicy = {
  retentionDays: number;
  minimumProtectedDays: number;
  batchSize: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuditRetentionPurgeResult = {
  retentionDays: number;
  batchSize: number;
  isEnabled: boolean;
  cutoffAt: string;
  selectedCount: number;
  deletedCount: number;
  durationMs?: number;
};

export type SystemEventRetentionPolicy = {
  retentionDays: number;
  minimumProtectedDays: number;
  batchSize: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SystemEventRetentionPurgeResult = AuditRetentionPurgeResult;

export type SystemEventType = "error" | "warning" | "job_run" | "health_check" | "integration_failure";

export type SystemEventSeverity = "info" | "warning" | "error" | "critical";

export type SystemEvent = {
  id: string;
  occurredAt: string;
  eventType: SystemEventType;
  severity: SystemEventSeverity;
  source: string;
  status: string;
  message: string;
  detail: string;
  requestMethod: string;
  requestPath: string;
  responseStatus?: number;
  actorEmail: string;
  actorRole: string;
  environment: string;
  appVersion: string;
  durationMs?: number;
  metadata: Record<string, unknown>;
};

export type SystemEventFilters = {
  eventType?: string;
  severity?: string;
  source?: string;
  status?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

export type AuditEvent = {
  id: string;
  occurredAt: string;
  action: string;
  targetTable: string;
  targetRecordId: string;
  actorEmail: string;
  actorRole: string;
  actorExternalSubject: string;
  actorDatabaseUser: string;
  actorSessionUser: string;
  source: string;
  reason: string;
  changedFields: string[];
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type AuditEventFilters = {
  action?: string;
  targetTable?: string;
  actor?: string;
  targetRecordId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};
