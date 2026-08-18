import { apiBaseUrl } from "../config/environment";
import type { DeedRegistrySuggestion, SaveOwnershipEventInput, UpdateOwnerInput } from "../types";
import { authorizedFetch, jsonRequest, jsonResponse, normalizeBaseUrl } from "./apiClient";

export async function createOwnershipEvent(cemeteryId: string, graveSpaceId: string, event: SaveOwnershipEventInput): Promise<{ id: string }> {
  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/cemeteries/${encodeURIComponent(cemeteryId)}/grave-spaces/${encodeURIComponent(graveSpaceId)}/ownership-events`,
    jsonRequest("POST", event),
  );
  return jsonResponse<{ id: string }>(response, "Ownership event API");
}

export async function fetchDeedRegistrySuggestions(cemeteryId: string, ownerNames: string): Promise<DeedRegistrySuggestion[]> {
  const params = new URLSearchParams({ q: ownerNames });
  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/cemeteries/${encodeURIComponent(cemeteryId)}/deed-registry-suggestions?${params.toString()}`,
  );
  return jsonResponse<DeedRegistrySuggestion[]>(response, "Deed registry suggestion API");
}

export async function updateGraveLot(cemeteryId: string, graveSpaceId: string, lotId: string): Promise<{ id: string; lotId: string }> {
  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/cemeteries/${encodeURIComponent(cemeteryId)}/grave-spaces/${encodeURIComponent(graveSpaceId)}/lot`,
    jsonRequest("PATCH", { lotId, reason: "Manual lot assignment from gravesite detail" }),
  );
  return jsonResponse<{ id: string; lotId: string }>(response, "Update gravesite lot API");
}

export async function updateOwner(partyId: string, eventId: string, owner: UpdateOwnerInput): Promise<{ id: string }> {
  const cleanId = (id: string) => id.replace(/^ownership-(?:party|event)-/u, "");
  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/ownership-parties/${encodeURIComponent(cleanId(partyId))}/events/${encodeURIComponent(cleanId(eventId))}`,
    jsonRequest("PATCH", owner),
  );
  return jsonResponse<{ id: string }>(response, "Update owner API");
}

export async function removeGravesiteOwnershipRight(rightId: string): Promise<{ id: string }> {
  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/ownership-event-rights/${encodeURIComponent(rightId)}`,
    jsonRequest("DELETE", { reason: "Remove incorrect gravesite ownership connection" }),
  );
  return jsonResponse<{ id: string }>(response, "Remove gravesite ownership connection API");
}

