import { sortedMediaAssets } from "../../lib/media";
import type { Headstone, MediaAsset } from "../../types";

export type OverviewImage = { url: string; label: string; date?: string; linkedMarker?: string; isPrimary?: boolean };

export function overviewImages(assets: MediaAsset[], markers: Headstone[] = []): OverviewImage[] {
  const all = [...assets, ...markers.flatMap((marker) => marker.mediaAssets ?? [])];
  const byId = new Map<string, MediaAsset>();
  for (const asset of all.filter((photo) => photo.assetType === "photo" && photo.fileUrl)) {
    const existing = byId.get(asset.id);
    byId.set(asset.id, { ...asset, isPrimary: Boolean(asset.isPrimary || existing?.isPrimary) });
  }
  const unique = [...byId.values()];
  const images: OverviewImage[] = sortedMediaAssets(unique).map((asset) => ({
    url: asset.fileUrl, label: asset.notes || asset.originalFilename || "Cemetery record photo",
    isPrimary: asset.isPrimary,
    date: asset.capturedAt ?? asset.uploadedAt,
    linkedMarker: markers.find((marker) => marker.mediaAssets?.some((photo) => photo.id === asset.id))?.headstoneId,
  }));
  // Legacy marker photo URLs have no reliable date; use them only as a fallback.
  if (!images.length) for (const marker of markers) {
    if (marker.photoUrl && !images.some((image) => image.url === marker.photoUrl)) {
      images.push({ url: marker.photoUrl, label: `Marker ${marker.headstoneId}`, date: undefined, linkedMarker: marker.headstoneId });
    }
  }
  return images;
}
