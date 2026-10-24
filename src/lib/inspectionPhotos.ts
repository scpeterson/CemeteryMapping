import type { PhotoContext } from "../api/mediaApi";
import type { MediaAsset } from "../types";

export type InspectionPhotoDraft = {
  id: string; faceId: string; file?: File; mediaAssetId?: string;
  notes: string; capturedAt: string; saved?: boolean; missingFileName?: string;
};

/** Saved links plus draft assignments, scoped to one face and counted once per asset. */
export function inspectionFacePhotos(faceId: string, photos: InspectionPhotoDraft[], assets: MediaAsset[], links: PhotoContext[]) {
  const own = photos.filter(photo => photo.faceId === faceId);
  const assignments = new Map(photos.flatMap(photo => photo.mediaAssetId ? [[photo.mediaAssetId, photo.faceId] as const] : []));
  const linkedAssets = assets.filter(asset => asset.assetType === "photo" && links.some(link => link.mediaAssetId === asset.id && link.faceId === faceId)
    && (!assignments.has(asset.id) || assignments.get(asset.id) === faceId));
  const linkedIds = new Set(linkedAssets.map(asset => asset.id));
  const selectedIds = new Set(own.flatMap(photo => photo.mediaAssetId ? [photo.mediaAssetId] : []));
  const selectedCount = own.filter(photo => photo.file).length + [...selectedIds].filter(id => !linkedIds.has(id)).length;
  return {own, linkedAssets, linkedOnly: linkedAssets.filter(asset => !selectedIds.has(asset.id)), selectedCount, linkedCount: linkedIds.size, total: linkedIds.size + selectedCount};
}
