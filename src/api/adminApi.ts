import { apiBaseUrl } from "../config/environment";
import type {
  AppRole,
  AppUser,
  AuditRetentionPolicy,
  AuditRetentionPurgeResult,
  AuditEvent,
  AuditEventFilters,
  Auth0ResolvedUser,
  BulkEditResult,
  CemeteryAdminRecords,
  CemeteryTextRecord,
  DataQualityDashboard,
  DeedInvestigationCase,
  DeedRegistryReview,
  DeedRegistryReviewFilters,
  LookupAdminRecords,
  LookupRecord,
  LotTextRecord,
  NorthHillsOcrReview,
  NorthHillsOcrReviewFilters,
  SaveNorthHillsOcrEntryInput,
  NorthHillsSourceFact,
  PromoteNorthHillsSourceFactInput,
  ReviewNorthHillsSourceFactInput,
  SaveNorthHillsOcrEvidenceInput,
  SaveSourcePersonRecordInput,
  SaveDeedInvestigationCaseInput,
  SaveDeedInvestigationActionInput,
  SaveDeedRegistryMappingInput,
  SectionTextRecord,
  SourcePersonRecord,
  SourcePersonRecordFilters,
  SourcePersonRecordReview,
  SystemEvent,
  SystemEventFilters,
  SystemEventRetentionPolicy,
  SystemEventRetentionPurgeResult,
} from "../types";
import { authorizedFetch, jsonRequest, jsonResponse, normalizeBaseUrl } from "./apiClient";

export async function fetchAdminRoles(): Promise<AppRole[]> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/roles`);
  return jsonResponse<AppRole[]>(response, "Roles API");
}

export async function fetchAdminUsers(): Promise<AppUser[]> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/users`);
  return jsonResponse<AppUser[]>(response, "Users API");
}

export type SaveUserInput = Pick<AppUser, "email" | "externalSubject" | "displayName" | "role" | "assignedCemeteryIds" | "isActive">;

export type ResolveAuth0UserInput = Pick<AppUser, "email" | "displayName">;

export async function resolveAuth0User(user: ResolveAuth0UserInput): Promise<Auth0ResolvedUser> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/auth0-users/resolve`, jsonRequest("POST", user));
  return jsonResponse<Auth0ResolvedUser>(response, "Auth0 user API");
}

export async function createAdminUser(user: SaveUserInput): Promise<AppUser> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/users`, jsonRequest("POST", user));
  return jsonResponse<AppUser>(response, "Create user API");
}

export async function updateAdminUser(id: string, user: SaveUserInput): Promise<AppUser> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/users/${encodeURIComponent(id)}`, jsonRequest("PUT", user));
  return jsonResponse<AppUser>(response, "Update user API");
}

export type SaveCemeteryTextInput = Pick<
  CemeteryTextRecord,
  | "name"
  | "fullAddress"
  | "municipality"
  | "agency"
  | "agencyUrl"
  | "operationalHours"
  | "contactName"
  | "contactPhone"
  | "contactEmail"
  | "imageUrl"
  | "notes"
>;
export type SaveSectionTextInput = Pick<SectionTextRecord, "name" | "alternateNames" | "notes">;
export type SaveLotTextInput = Pick<LotTextRecord, "name">;
export type SaveLookupInput = Pick<LookupRecord, "code" | "label" | "description" | "sortOrder" | "isActive" | "sourceNotes" | "sourceUrl">;
export type SaveAuditRetentionPolicyInput = Pick<AuditRetentionPolicy, "retentionDays" | "minimumProtectedDays" | "batchSize" | "isEnabled"> & {
  reason?: string;
};
export type SaveSystemEventRetentionPolicyInput = Pick<SystemEventRetentionPolicy, "retentionDays" | "minimumProtectedDays" | "batchSize" | "isEnabled"> & {
  reason?: string;
};

export async function fetchCemeteryAdminRecords(): Promise<CemeteryAdminRecords> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/cemetery-records`);
  return jsonResponse<CemeteryAdminRecords>(response, "Cemetery admin records API");
}

export async function fetchDataQualityDashboard(): Promise<DataQualityDashboard> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/data-quality-dashboard`);
  return jsonResponse<DataQualityDashboard>(response, "Data quality dashboard API");
}

export async function fetchAdminAuditEvents(filters: AuditEventFilters = {}): Promise<AuditEvent[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/audit-events${query ? `?${query}` : ""}`);
  return jsonResponse<AuditEvent[]>(response, "Audit events API");
}

export async function fetchAuditRetentionPolicy(): Promise<AuditRetentionPolicy> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/audit-retention-policy`);
  return jsonResponse<AuditRetentionPolicy>(response, "Audit retention policy API");
}

export async function updateAuditRetentionPolicy(policy: SaveAuditRetentionPolicyInput): Promise<AuditRetentionPolicy> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/audit-retention-policy`, jsonRequest("PUT", policy));
  return jsonResponse<AuditRetentionPolicy>(response, "Update audit retention policy API");
}

export async function runAuditRetentionPurge(): Promise<AuditRetentionPurgeResult> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/audit-retention-purge`, jsonRequest("POST", {}));
  return jsonResponse<AuditRetentionPurgeResult>(response, "Audit retention purge API");
}

export async function fetchSystemEvents(filters: SystemEventFilters = {}): Promise<SystemEvent[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/system-events${query ? `?${query}` : ""}`);
  return jsonResponse<SystemEvent[]>(response, "System events API");
}

export async function fetchSystemEventRetentionPolicy(): Promise<SystemEventRetentionPolicy> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/system-event-retention-policy`);
  return jsonResponse<SystemEventRetentionPolicy>(response, "System event retention policy API");
}

export async function updateSystemEventRetentionPolicy(policy: SaveSystemEventRetentionPolicyInput): Promise<SystemEventRetentionPolicy> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/system-event-retention-policy`, jsonRequest("PUT", policy));
  return jsonResponse<SystemEventRetentionPolicy>(response, "Update system event retention policy API");
}

export async function runSystemEventRetentionPurge(): Promise<SystemEventRetentionPurgeResult> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/system-event-retention-purge`, jsonRequest("POST", {}));
  return jsonResponse<SystemEventRetentionPurgeResult>(response, "System event retention purge API");
}

export async function fetchDeedRegistryReview(filters: DeedRegistryReviewFilters = {}): Promise<DeedRegistryReview> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/deed-registry-review${query ? `?${query}` : ""}`);
  return jsonResponse<DeedRegistryReview>(response, "Deed registry review API");
}

export async function updateDeedRegistryMapping(entryId: string, mapping: SaveDeedRegistryMappingInput): Promise<{ id: string }> {
  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/admin/deed-registry-review/${encodeURIComponent(entryId)}`,
    jsonRequest("PUT", mapping),
  );
  return jsonResponse<{ id: string }>(response, "Deed registry mapping API");
}

export type DeedInvestigationCaseFilters = {
  q?: string;
  status?: string;
  limit?: number;
};

export async function fetchDeedInvestigationCases(filters: DeedInvestigationCaseFilters = {}): Promise<DeedInvestigationCase[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/deed-investigation-cases${query ? `?${query}` : ""}`);
  return jsonResponse<DeedInvestigationCase[]>(response, "Deed investigation cases API");
}

export async function createDeedInvestigationCase(investigation: SaveDeedInvestigationCaseInput): Promise<DeedInvestigationCase> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/deed-investigation-cases`, jsonRequest("POST", investigation));
  return jsonResponse<DeedInvestigationCase>(response, "Create deed investigation case API");
}

export async function updateDeedInvestigationCase(id: string, investigation: SaveDeedInvestigationCaseInput): Promise<DeedInvestigationCase> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/deed-investigation-cases/${encodeURIComponent(id)}`, jsonRequest("PUT", investigation));
  return jsonResponse<DeedInvestigationCase>(response, "Update deed investigation case API");
}

export async function linkDeedInvestigationCaseEntry(caseId: string, entryId: string, note = ""): Promise<DeedInvestigationCase> {
  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/admin/deed-investigation-cases/${encodeURIComponent(caseId)}/evidence`,
    jsonRequest("POST", { entryId, note, reason: "Linked deed evidence to investigation case." }),
  );
  return jsonResponse<DeedInvestigationCase>(response, "Link deed investigation evidence API");
}

export async function createDeedInvestigationAction(caseId: string, action: SaveDeedInvestigationActionInput) {
  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/admin/deed-investigation-cases/${encodeURIComponent(caseId)}/actions`,
    jsonRequest("POST", action),
  );
  return jsonResponse<DeedInvestigationCase["recommendedActions"][number]>(response, "Create deed investigation action API");
}

export async function updateDeedInvestigationAction(caseId: string, actionId: string, action: SaveDeedInvestigationActionInput) {
  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/admin/deed-investigation-cases/${encodeURIComponent(caseId)}/actions/${encodeURIComponent(actionId)}`,
    jsonRequest("PUT", action),
  );
  return jsonResponse<DeedInvestigationCase["recommendedActions"][number]>(response, "Update deed investigation action API");
}

export async function fetchNorthHillsOcrReview(filters: NorthHillsOcrReviewFilters = {}): Promise<NorthHillsOcrReview> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/north-hills-ocr-review${query ? `?${query}` : ""}`);
  return jsonResponse<NorthHillsOcrReview>(response, "North Hills readings review API");
}

export async function updateNorthHillsOcrEntry(entryId: string, entry: SaveNorthHillsOcrEntryInput): Promise<void> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/north-hills-ocr-review/${encodeURIComponent(entryId)}`, jsonRequest("PUT", entry));
  await jsonResponse<unknown>(response, "Update North Hills reading API");
}

export async function saveNorthHillsOcrEvidence(entryId: string, evidence: SaveNorthHillsOcrEvidenceInput): Promise<void> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/north-hills-ocr-review/${encodeURIComponent(entryId)}/evidence`, jsonRequest("POST", evidence));
  await jsonResponse<unknown>(response, "North Hills evidence API");
}

export async function deleteNorthHillsOcrEvidence(entryId: string, evidence: Pick<SaveNorthHillsOcrEvidenceInput, "targetType" | "targetId">): Promise<void> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/north-hills-ocr-review/${encodeURIComponent(entryId)}/evidence`, jsonRequest("DELETE", evidence));
  await jsonResponse<unknown>(response, "North Hills evidence unlink API");
}

export async function reviewNorthHillsSourceFact(factId: string, review: ReviewNorthHillsSourceFactInput): Promise<NorthHillsSourceFact> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/north-hills-source-facts/${encodeURIComponent(factId)}/review`, jsonRequest("POST", review));
  return jsonResponse<NorthHillsSourceFact>(response, "North Hills source fact review API");
}

export async function promoteNorthHillsSourceFact(factId: string, promotion: PromoteNorthHillsSourceFactInput): Promise<NorthHillsSourceFact> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/north-hills-source-facts/${encodeURIComponent(factId)}/promote`, jsonRequest("POST", promotion));
  return jsonResponse<NorthHillsSourceFact>(response, "North Hills source fact promotion API");
}

export type BulkHeadstoneUpdateInput = {
  identifiers: string[];
  markerTypeId?: string;
  materialId?: string;
  conditionId?: string;
  reason: string;
};

export async function bulkUpdateHeadstones(input: BulkHeadstoneUpdateInput): Promise<BulkEditResult> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/bulk/headstones`, jsonRequest("POST", input));
  return jsonResponse<BulkEditResult>(response, "Bulk marker update API");
}

export async function bulkAssignGravesitesToLot(input: { identifiers: string[]; lotId: string; reason: string }): Promise<BulkEditResult> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/bulk/gravesites/lot`, jsonRequest("POST", input));
  return jsonResponse<BulkEditResult>(response, "Bulk gravesite lot assignment API");
}

export async function bulkMarkNorthHillsReviewed(input: { entryIds: string[]; reason: string }): Promise<BulkEditResult> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/bulk/north-hills/reviewed`, jsonRequest("POST", input));
  return jsonResponse<BulkEditResult>(response, "Bulk North Hills review API");
}

export async function bulkAddNorthHillsEntryNote(input: { entryIds: string[]; note: string; reason: string }): Promise<BulkEditResult> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/bulk/north-hills/entry-note`, jsonRequest("POST", input));
  return jsonResponse<BulkEditResult>(response, "Bulk North Hills note API");
}

export async function fetchSourcePersonRecords(filters: SourcePersonRecordFilters = {}): Promise<SourcePersonRecordReview> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/source-person-records${query ? `?${query}` : ""}`);
  return jsonResponse<SourcePersonRecordReview>(response, "Source-only person records API");
}

export async function createSourcePersonRecord(record: SaveSourcePersonRecordInput): Promise<SourcePersonRecord> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/source-person-records`, jsonRequest("POST", record));
  return jsonResponse<SourcePersonRecord>(response, "Create source-only person record API");
}

export async function updateSourcePersonRecord(id: string, record: SaveSourcePersonRecordInput): Promise<SourcePersonRecord> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/source-person-records/${encodeURIComponent(id)}`, jsonRequest("PUT", record));
  return jsonResponse<SourcePersonRecord>(response, "Update source-only person record API");
}

export async function deleteSourcePersonRecord(id: string, reason?: string): Promise<{ id: string; cemeteryId: string; deletedAt: string; alreadyDeleted: boolean }> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/source-person-records/${encodeURIComponent(id)}`, jsonRequest("DELETE", { reason }));
  return jsonResponse<{ id: string; cemeteryId: string; deletedAt: string; alreadyDeleted: boolean }>(response, "Delete source-only person record API");
}

export async function fetchLookupAdminRecords(): Promise<LookupAdminRecords> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/lookups`);
  return jsonResponse<LookupAdminRecords>(response, "Lookup records API");
}

export async function createLookupRecord(table: string, lookup: SaveLookupInput): Promise<LookupRecord> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/lookups/${encodeURIComponent(table)}`, jsonRequest("POST", lookup));
  return jsonResponse<LookupRecord>(response, "Create lookup API");
}

export async function updateLookupRecord(table: string, id: string, lookup: SaveLookupInput): Promise<LookupRecord> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/lookups/${encodeURIComponent(table)}/${encodeURIComponent(id)}`, jsonRequest("PUT", lookup));
  return jsonResponse<LookupRecord>(response, "Update lookup API");
}

export async function updateCemeteryText(id: string, cemetery: SaveCemeteryTextInput): Promise<CemeteryTextRecord> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/cemetery-records/cemeteries/${encodeURIComponent(id)}`, jsonRequest("PUT", cemetery));
  return jsonResponse<CemeteryTextRecord>(response, "Update cemetery API");
}

export async function updateSectionText(id: string, section: SaveSectionTextInput): Promise<SectionTextRecord> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/cemetery-records/sections/${encodeURIComponent(id)}`, jsonRequest("PUT", section));
  return jsonResponse<SectionTextRecord>(response, "Update section API");
}

export async function updateLotText(id: string, lot: SaveLotTextInput): Promise<LotTextRecord> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/cemetery-records/lots/${encodeURIComponent(id)}`, jsonRequest("PUT", lot));
  return jsonResponse<LotTextRecord>(response, "Update lot API");
}
