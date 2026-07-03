import { apiBaseUrl } from "../config/environment";
import type {
  AppRole,
  AppUser,
  AuditRetentionPolicy,
  AuditRetentionPurgeResult,
  AppVersion,
  AuditEvent,
  AuditEventFilters,
  Auth0ResolvedUser,
  Burial,
  CemeteryAdminRecords,
  CemeteryData,
  GraveFeature,
  MaintenanceRecord,
  CemeteryTextRecord,
  DeedInvestigationCase,
  DeedRegistryReview,
  DeedRegistryReviewFilters,
  CurrentUser,
  GraveSpace,
  GraveStatus,
  Headstone,
  HeadstoneLookups,
  LookupAdminRecords,
  LookupRecord,
  LotTextRecord,
  MediaAsset,
  NorthHillsOcrReview,
  NorthHillsOcrReviewFilters,
  SaveNorthHillsOcrEntryInput,
  NorthHillsSourceFact,
  PromoteNorthHillsSourceFactInput,
  ReportDefinition,
  ReportQueryResponse,
  ReportResult,
  ReviewNorthHillsSourceFactInput,
  SaveNorthHillsOcrEvidenceInput,
  SaveBurialInput,
  SaveGraveFeatureInput,
  SaveMaintenanceRecordInput,
  SaveGraveSpaceInput,
  SaveHeadstoneInput,
  SaveDeedInvestigationCaseInput,
  SaveDeedInvestigationActionInput,
  SaveOwnershipEventInput,
  SearchMatch,
  SectionTextRecord,
  SystemEvent,
  SystemEventFilters,
  SystemEventRetentionPolicy,
  SystemEventRetentionPurgeResult,
} from "../types";

type AccessTokenProvider = () => Promise<string | undefined>;

let accessTokenProvider: AccessTokenProvider | undefined;

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/$/u, "");

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export function setAccessTokenProvider(provider: AccessTokenProvider | undefined) {
  accessTokenProvider = provider;
}

async function authorizedFetch(url: string, init?: RequestInit) {
  const token = await accessTokenProvider?.();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

async function responseErrorDetail(response: Response) {
  try {
    const body = (await response.clone().json()) as { error?: unknown };
    return typeof body.error === "string" && body.error.trim() ? `: ${body.error.trim()}` : "";
  } catch {
    return "";
  }
}

async function jsonResponse<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) {
    const detail = await responseErrorDetail(response);
    throw new Error(`${label} returned ${response.status}${detail}`);
  }
  return (await response.json()) as T;
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function fetchCemeteryData(attempts = 5): Promise<CemeteryData> {
  const url = `${normalizeBaseUrl(apiBaseUrl)}/cemetery-map`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await authorizedFetch(url);
      if (!response.ok) throw new Error(`Cemetery API returned ${response.status}`);
      return (await response.json()) as CemeteryData;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(200 * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to load cemetery data");
}

export async function fetchAppVersion(): Promise<AppVersion> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/version`);
  return jsonResponse<AppVersion>(response, "Version API");
}

export async function fetchGraveSpace(cemeteryId: string, id: string): Promise<GraveSpace> {
  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/cemeteries/${encodeURIComponent(cemeteryId)}/grave-spaces/${encodeURIComponent(id)}`,
  );
  return jsonResponse<GraveSpace>(response, "Grave API");
}

export async function updateGraveSpace(cemeteryId: string, id: string, graveSpace: SaveGraveSpaceInput): Promise<GraveSpace> {
  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/cemeteries/${encodeURIComponent(cemeteryId)}/grave-spaces/${encodeURIComponent(id)}`,
    jsonRequest("PATCH", graveSpace),
  );
  return jsonResponse<GraveSpace>(response, "Update grave space API");
}

export async function updateBurial(id: string, burial: SaveBurialInput): Promise<Burial> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/burials/${encodeURIComponent(id)}`, jsonRequest("PATCH", burial));
  return jsonResponse<Burial>(response, "Update burial API");
}

export async function createGraveFeature(cemeteryId: string, feature: SaveGraveFeatureInput): Promise<GraveFeature> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/cemeteries/${encodeURIComponent(cemeteryId)}/grave-features`, jsonRequest("POST", feature));
  return jsonResponse<GraveFeature>(response, "Grave feature API");
}

export async function updateGraveFeature(id: string, feature: SaveGraveFeatureInput): Promise<GraveFeature> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/grave-features/${encodeURIComponent(id)}`, jsonRequest("PATCH", feature));
  return jsonResponse<GraveFeature>(response, "Update grave feature API");
}

export async function deleteGraveFeature(id: string, reason?: string): Promise<{ id: string; cemeteryId: string; deletedAt: string; alreadyDeleted: boolean }> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/grave-features/${encodeURIComponent(id)}`, jsonRequest("DELETE", { reason }));
  return jsonResponse<{ id: string; cemeteryId: string; deletedAt: string; alreadyDeleted: boolean }>(response, "Delete grave feature API");
}

export async function createMaintenanceRecord(cemeteryId: string, record: SaveMaintenanceRecordInput): Promise<MaintenanceRecord> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/cemeteries/${encodeURIComponent(cemeteryId)}/maintenance-records`, jsonRequest("POST", record));
  return jsonResponse<MaintenanceRecord>(response, "Maintenance record API");
}

export async function updateMaintenanceRecord(id: string, record: SaveMaintenanceRecordInput): Promise<MaintenanceRecord> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/maintenance-records/${encodeURIComponent(id)}`, jsonRequest("PATCH", record));
  return jsonResponse<MaintenanceRecord>(response, "Update maintenance record API");
}

export async function createOwnershipEvent(cemeteryId: string, graveSpaceId: string, event: SaveOwnershipEventInput): Promise<{ id: string }> {
  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/cemeteries/${encodeURIComponent(cemeteryId)}/grave-spaces/${encodeURIComponent(graveSpaceId)}/ownership-events`,
    jsonRequest("POST", event),
  );
  return jsonResponse<{ id: string }>(response, "Ownership event API");
}

export async function fetchSearchMatches(query: string, statuses: Set<GraveStatus>, signal?: AbortSignal): Promise<SearchMatch[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query);
  params.set("status", [...statuses].join(","));

  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/search?${params.toString()}`, { signal });
  return jsonResponse<SearchMatch[]>(response, "Search API");
}

export async function fetchReports(): Promise<ReportDefinition[]> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/reports`);
  return jsonResponse<ReportDefinition[]>(response, "Reports API");
}

export async function runReport(reportId: string, parameters: Record<string, string> = {}): Promise<ReportResult> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/reports/run`, jsonRequest("POST", { reportId, parameters }));
  return jsonResponse<ReportResult>(response, "Run report API");
}

export async function queryReports(query: string, parameters: Record<string, string> = {}): Promise<ReportQueryResponse> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/reports/query`, jsonRequest("POST", { query, parameters }));
  return jsonResponse<ReportQueryResponse>(response, "Report query API");
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/me`);
  return jsonResponse<CurrentUser>(response, "Current user API");
}

export async function fetchHeadstoneLookups(): Promise<HeadstoneLookups> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/headstone-lookups`);
  const lookups = await jsonResponse<Partial<HeadstoneLookups>>(response, "Headstone lookup API");
  return {
    markerTypes: lookups.markerTypes ?? [],
    materials: lookups.materials ?? [],
    conditions: lookups.conditions ?? [],
    vaseTypes: lookups.vaseTypes ?? [],
    vaseMaterials: lookups.vaseMaterials ?? [],
    vasePlacements: lookups.vasePlacements ?? [],
    graveFeatureTypes: lookups.graveFeatureTypes ?? [],
    graveFeatureSubtypes: lookups.graveFeatureSubtypes ?? [],
    graveFeaturePlacements: lookups.graveFeaturePlacements ?? [],
    graveFeatureMaterials: lookups.graveFeatureMaterials ?? [],
    intermentTypes: lookups.intermentTypes ?? [],
    burialRecordStatuses: lookups.burialRecordStatuses ?? [],
    militaryBranches: lookups.militaryBranches ?? [],
    militaryRanks: lookups.militaryRanks ?? [],
    militaryWarServices: lookups.militaryWarServices ?? [],
    maintenanceIssueTypes: lookups.maintenanceIssueTypes ?? [],
    maintenanceActionTypes: lookups.maintenanceActionTypes ?? [],
    maintenancePriorities: lookups.maintenancePriorities ?? [],
  };
}

export async function fetchHeadstone(id: string): Promise<Headstone> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/headstones/${encodeURIComponent(id)}`);
  return jsonResponse<Headstone>(response, "Headstone API");
}

export async function updateHeadstone(id: string, headstone: SaveHeadstoneInput): Promise<Headstone> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/headstones/${encodeURIComponent(id)}`, jsonRequest("PATCH", headstone));
  return jsonResponse<Headstone>(response, "Update headstone API");
}

export type UploadGravePhotoInput = {
  cemeteryId: string;
  graveSpaceId: string;
  file: File;
  headstoneId?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  gpsAccuracy?: number;
  capturedAt?: string;
  source?: string;
};

export async function uploadGravePhoto(input: UploadGravePhotoInput): Promise<MediaAsset> {
  const params = new URLSearchParams();
  params.set("filename", input.file.name);
  params.set("notes", input.notes ?? "");
  if (input.capturedAt) params.set("capturedAt", input.capturedAt);
  params.set("source", input.source ?? "field_upload");
  if (input.headstoneId) params.set("headstoneId", input.headstoneId);
  if (input.latitude !== undefined) params.set("latitude", String(input.latitude));
  if (input.longitude !== undefined) params.set("longitude", String(input.longitude));
  if (input.gpsAccuracy !== undefined) params.set("gpsAccuracy", String(input.gpsAccuracy));

  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/cemeteries/${encodeURIComponent(input.cemeteryId)}/grave-spaces/${encodeURIComponent(input.graveSpaceId)}/media-assets?${params.toString()}`,
    {
      method: "POST",
      headers: { "Content-Type": input.file.type || "image/jpeg" },
      body: input.file,
    },
  );
  return jsonResponse<MediaAsset>(response, "Photo upload API");
}

export type UploadHeadstonePhotoInput = Omit<UploadGravePhotoInput, "graveSpaceId" | "headstoneId"> & {
  headstoneId: string;
};

export async function uploadHeadstonePhoto(input: UploadHeadstonePhotoInput): Promise<MediaAsset> {
  const params = new URLSearchParams();
  params.set("filename", input.file.name);
  params.set("notes", input.notes ?? "");
  if (input.capturedAt) params.set("capturedAt", input.capturedAt);
  params.set("source", input.source ?? "field_upload");
  if (input.latitude !== undefined) params.set("latitude", String(input.latitude));
  if (input.longitude !== undefined) params.set("longitude", String(input.longitude));
  if (input.gpsAccuracy !== undefined) params.set("gpsAccuracy", String(input.gpsAccuracy));

  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/headstones/${encodeURIComponent(input.headstoneId)}/media-assets?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": input.file.type || "image/jpeg" },
    body: input.file,
  });
  return jsonResponse<MediaAsset>(response, "Marker photo upload API");
}

export async function deleteMediaAsset(id: string, reason?: string): Promise<{ id: string; cemeteryId: string; deletedAt: string; alreadyDeleted: boolean }> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/media-assets/${encodeURIComponent(id)}`, jsonRequest("DELETE", { reason }));
  return jsonResponse<{ id: string; cemeteryId: string; deletedAt: string; alreadyDeleted: boolean }>(response, "Photo delete API");
}

export type MoveMediaAssetInput = {
  id: string;
  linkId: string;
  linkType: "headstone" | "gravesite";
  direction: "earlier" | "later";
};

export async function moveMediaAsset(input: MoveMediaAssetInput): Promise<{ moved: boolean }> {
  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/media-assets/${encodeURIComponent(input.id)}/order`,
    jsonRequest("PATCH", {
      linkId: input.linkId,
      linkType: input.linkType,
      direction: input.direction,
    }),
  );
  return jsonResponse<{ moved: boolean }>(response, "Photo order API");
}

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
