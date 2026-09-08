import { sortedMediaAssets } from "../../lib/media";
import type { Headstone, MediaAsset } from "../../types";

export type OverviewImage = { url: string; label: string; date?: string; linkedMarker?: string };

export function overviewImages(assets: MediaAsset[], markers: Headstone[] = []): OverviewImage[] {
  const all = [...assets, ...markers.flatMap((marker) => marker.mediaAssets ?? [])];
  const unique = [...new Map(all.filter((asset) => asset.assetType === "photo" && asset.fileUrl).map((asset) => [asset.id, asset])).values()];
  const images: OverviewImage[] = sortedMediaAssets(unique).map((asset) => ({
    url: asset.fileUrl, label: asset.notes || asset.originalFilename || "Cemetery record photo",
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

