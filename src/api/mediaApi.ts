import { apiBaseUrl } from "../config/environment";
import type { MediaAsset } from "../types";
import { authorizedFetch, jsonRequest, jsonResponse, normalizeBaseUrl } from "./apiClient";

export type UploadHeadstonePhotoInput = {
  inspectionId?: string;
  maintenanceRecordId?: string; faceId?: string;
  phase?: "unspecified" | "before" | "during" | "after";
  headstoneId: string;
  file: File;
  notes?: string;
  latitude?: number;
  longitude?: number;
  gpsAccuracy?: number;
  capturedAt?: string;
  source?: string;
};

export async function uploadHeadstonePhoto(input: UploadHeadstonePhotoInput): Promise<MediaAsset> {
  const params = new URLSearchParams();
  if (input.inspectionId) params.set("inspectionId", input.inspectionId);
  if (input.maintenanceRecordId) params.set("maintenanceRecordId", input.maintenanceRecordId);
  if (input.faceId) params.set("faceId", input.faceId);
  if (input.phase) params.set("phase", input.phase);
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
  direction: "earlier" | "later" | "primary" | "automatic";
};

export async function moveMediaAsset(input: MoveMediaAssetInput): Promise<{ moved: boolean; updates: { id: string; is_primary?: boolean }[] }> {
  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/media-assets/${encodeURIComponent(input.id)}/order`,
    jsonRequest("PATCH", {
      linkId: input.linkId,
      linkType: input.linkType,
      direction: input.direction,
    }),
  );
  return jsonResponse<{ moved: boolean; updates: { id: string; is_primary?: boolean }[] }>(response, "Photo order API");
}


export type PhotoContext = { id: string; mediaAssetId: string; inspectionId?: string; maintenanceRecordId?: string; faceId?: string; phase: "unspecified" | "before" | "during" | "after" };
export type PhotoContextTarget = { inspectionId?: string; maintenanceRecordId?: string; faceId?: string; phase?: PhotoContext["phase"] };
export async function fetchPhotoContexts(headstoneId: string, signal?: AbortSignal): Promise<PhotoContext[]> {
 const response=await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/headstones/${encodeURIComponent(headstoneId)}/photo-contexts`,{signal});
 return jsonResponse<PhotoContext[]>(response,"Record photos API");
}
export async function savePhotoContext(headstoneId: string,mediaId: string,target: PhotoContextTarget,remove=false): Promise<void> {
 const response=await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/headstones/${encodeURIComponent(headstoneId)}/photo-contexts/${encodeURIComponent(mediaId)}`,jsonRequest(remove?"DELETE":"PUT",target));
 await jsonResponse(response,"Record photo link API");
}
