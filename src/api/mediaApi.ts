import { apiBaseUrl } from "../config/environment";
import type { MediaAsset } from "../types";
import { authorizedFetch, jsonRequest, jsonResponse, normalizeBaseUrl } from "./apiClient";

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

