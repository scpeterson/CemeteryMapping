import { apiBaseUrl } from "../config/environment";
import type {
  AppVersion,
  Burial,
  CemeteryData,
  CurrentUser,
  GeographicPlaceCandidate,
  GraveFeature,
  GraveSpace,
  GraveStatus,
  Headstone,
  HeadstoneGravesiteRelationship,
  HeadstoneLookups,
  HeadstoneRelationship,
  MaintenanceRecord,
  PlaceSearchResponse,
  SaveBurialInput,
  SaveGraveFeatureInput,
  SaveGraveSpaceInput,
  SaveHeadstoneCreateInput,
  SaveHeadstoneGravesiteRelationshipInput,
  SaveHeadstoneInput,
  SaveHeadstoneRelationshipInput,
  SaveMaintenanceRecordInput,
  SearchMatch,
  VerifiedPlace,
} from "../types";
import { authorizedFetch, jsonRequest, jsonResponse, normalizeBaseUrl } from "./apiClient";

export { setAccessTokenProvider } from "./apiClient";

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

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

export async function searchGeographicPlaces(query: string): Promise<PlaceSearchResponse> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/places/search?q=${encodeURIComponent(query)}`);
  return jsonResponse<PlaceSearchResponse>(response, "Place search API");
}

export async function importVerifiedPlace(candidate: GeographicPlaceCandidate): Promise<VerifiedPlace> {
  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/places/import`,
    jsonRequest("POST", { providerId: candidate.providerId }),
  );
  return jsonResponse<VerifiedPlace>(response, "Place import API");
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

export async function fetchSearchMatches(query: string, statuses: Set<GraveStatus>, signal?: AbortSignal): Promise<SearchMatch[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query);
  params.set("status", [...statuses].join(","));

  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/search?${params.toString()}`, { signal });
  return jsonResponse<SearchMatch[]>(response, "Search API");
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
    markerScopes: lookups.markerScopes ?? [],
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
    militaryDecorations: lookups.militaryDecorations ?? [],
    verifiedPlaces: lookups.verifiedPlaces ?? [],
    maintenanceIssueTypes: lookups.maintenanceIssueTypes ?? [],
    maintenanceActionTypes: lookups.maintenanceActionTypes ?? [],
    maintenancePriorities: lookups.maintenancePriorities ?? [],
    headstones: lookups.headstones ?? [],
    gravesites: lookups.gravesites ?? [],
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

export async function createGravesiteHeadstone(cemeteryId: string, graveSpaceId: string, headstone: SaveHeadstoneCreateInput): Promise<Headstone> {
  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/cemeteries/${encodeURIComponent(cemeteryId)}/gravesites/${encodeURIComponent(graveSpaceId)}/headstones`,
    jsonRequest("POST", headstone),
  );
  return jsonResponse<Headstone>(response, "Create marker API");
}

export async function createHeadstoneRelationship(headstoneId: string, relationship: SaveHeadstoneRelationshipInput): Promise<HeadstoneRelationship> {
  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/headstones/${encodeURIComponent(headstoneId)}/relationships`,
    jsonRequest("POST", relationship),
  );
  return jsonResponse<HeadstoneRelationship>(response, "Marker relationship API");
}

export async function updateHeadstoneRelationship(id: string, relationship: SaveHeadstoneRelationshipInput): Promise<HeadstoneRelationship> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/headstone-relationships/${encodeURIComponent(id)}`, jsonRequest("PATCH", relationship));
  return jsonResponse<HeadstoneRelationship>(response, "Update marker relationship API");
}

export async function deleteHeadstoneRelationship(id: string, reason?: string): Promise<{ id: string; deletedAt: string; alreadyDeleted: boolean }> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/headstone-relationships/${encodeURIComponent(id)}`, jsonRequest("DELETE", { reason }));
  return jsonResponse<{ id: string; deletedAt: string; alreadyDeleted: boolean }>(response, "Delete marker relationship API");
}

export async function createHeadstoneGravesiteRelationship(headstoneId: string, relationship: SaveHeadstoneGravesiteRelationshipInput): Promise<HeadstoneGravesiteRelationship> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/headstones/${encodeURIComponent(headstoneId)}/gravesites`, jsonRequest("POST", relationship));
  return jsonResponse<HeadstoneGravesiteRelationship>(response, "Marker gravesite relationship API");
}

export async function updateHeadstoneGravesiteRelationship(id: string, relationship: SaveHeadstoneGravesiteRelationshipInput): Promise<HeadstoneGravesiteRelationship> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/headstone-gravesite-relationships/${encodeURIComponent(id)}`, jsonRequest("PATCH", relationship));
  return jsonResponse<HeadstoneGravesiteRelationship>(response, "Update marker gravesite relationship API");
}

export async function deleteHeadstoneGravesiteRelationship(id: string, reason?: string): Promise<{ id: string; deletedAt: string; alreadyDeleted: boolean }> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/headstone-gravesite-relationships/${encodeURIComponent(id)}`, jsonRequest("DELETE", { reason }));
  return jsonResponse<{ id: string; deletedAt: string; alreadyDeleted: boolean }>(response, "Delete marker gravesite relationship API");
}

export * from "./adminApi";
export * from "./mediaApi";
export * from "./ownershipApi";
export * from "./reportsApi";
