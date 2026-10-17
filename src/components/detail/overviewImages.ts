import { sortedMediaAssets } from "../../lib/media";
import type { Headstone, MediaAsset } from "../../types";

export type OverviewImage = { url: string; thumbnailUrl?: string; label: string; date?: string; linkedMarker?: string; isPrimary?: boolean };

export function overviewImages(assets: MediaAsset[], markers: Headstone[] = []): OverviewImage[] {
  const all = [...assets, ...markers.flatMap((marker) => marker.mediaAssets ?? [])];
  const byId = new Map<string, MediaAsset>();
  for (const asset of all.filter((photo) => photo.assetType === "photo" && photo.fileUrl)) {
    const existing = byId.get(asset.id);
    byId.set(asset.id, { ...asset, isPrimary: Boolean(asset.isPrimary || existing?.isPrimary) });
  }
  const unique = [...byId.values()];
  const images: OverviewImage[] = sortedMediaAssets(unique).map((asset) => ({
    url: asset.fileUrl, thumbnailUrl: asset.thumbnailUrl || undefined, label: asset.notes || asset.originalFilename || "Cemetery record photo",
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

// Explicit grave primaries and individual markers take precedence. A shared
// marker primary must outrank ordinary grave photos, including duplicate links.
export function graveOverviewImages(
  grave: { id: string; burials: { id: string }[]; mediaAssets?: MediaAsset[] },
  markers: Headstone[] = [],
): OverviewImage[] {
  const burialIds = new Set(grave.burials.map((burial) => burial.id));
  const individualMarkers = markers.filter((marker) => {
    const graves = new Set([
      ...(marker.associatedGravesiteIds ?? []),
      ...(marker.gravesiteRelationships ?? []).map((link) => link.gravesiteId),
    ]);
    const people = marker.burialIds ?? [];
    const belongsHere = graves.has(grave.id) || people.some((id) => burialIds.has(id));
    return belongsHere && [...graves].every((id) => id === grave.id)
      && people.every((id) => burialIds.has(id));
  });
  const matchingFaces = markers.map((marker) => {
    const photoIds = new Set((marker.faces ?? [])
      .filter((face) => face.burialIds.some((id) => burialIds.has(id)))
      .flatMap((face) => face.mediaAssetIds));
    return { ...marker, photoUrl: "", mediaAssets: (marker.mediaAssets ?? []).filter((photo) => photoIds.has(photo.id)) };
  });
  const ownPhotos = grave.mediaAssets ?? [];
  const tiers = [
    overviewImages(ownPhotos.filter((photo) => photo.isPrimary)),
    overviewImages([], individualMarkers),
    overviewImages([], markers.map((marker) => ({
      ...marker, photoUrl: "", mediaAssets: (marker.mediaAssets ?? []).filter((photo) => photo.isPrimary),
    }))),
    overviewImages(ownPhotos),
    overviewImages([], matchingFaces),
    overviewImages([], markers),
  ];
  const seen = new Set<string>();
  return tiers.flat().filter((image) => {
    if (seen.has(image.url)) return false;
    seen.add(image.url);
    return true;
  });
}
