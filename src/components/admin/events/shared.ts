import { formatAdminTimestamp } from "../../../lib/format";
import type { AuditRetentionPurgeResult, SystemEventRetentionPurgeResult } from "../../../types";

export type AdminEventTabProps = {
  onError: (message: string | undefined) => void;
  onMessage: (message: string | undefined) => void;
};


export const formatEventJson = (value: Record<string, unknown>) => (Object.keys(value).length ? JSON.stringify(value, null, 2) : "None recorded");

export function retentionResultText(result: AuditRetentionPurgeResult | SystemEventRetentionPurgeResult) {
  return `Cutoff ${formatAdminTimestamp(result.cutoffAt)} - deleted ${result.deletedCount.toLocaleString()}`;
}
