import type { AuditEventFilters } from "../types";

export const defaultAuditFilters: AuditEventFilters = {
  action: "",
  targetTable: "",
  actor: "",
  targetRecordId: "",
  dateFrom: "",
  dateTo: "",
  limit: 50,
};
