import type { Burial, CemeteryData, GraveSpace, GraveSpaceSummary, Headstone, HeadstoneSummary, MediaAsset } from "../types";

const graveKey = (grave: Pick<GraveSpaceSummary, "cemeteryId" | "id">) => `${grave.cemeteryId}:${grave.id}`;

export function replaceHeadstoneInGrave(grave: GraveSpace | undefined, saved: Headstone) {
  if (!grave) return grave;
  return { ...grave, headstones: grave.headstones.map((candidate) => candidate.id === saved.id ? saved : candidate) };
}

export function replaceHeadstoneSummary(data: CemeteryData, saved: Headstone) {
  return {
    ...data,
    headstones: (data.headstones ?? []).map((candidate) => candidate.id === saved.id ? {
      ...candidate,
      markerTypeCode: saved.markerType.code,
      markerType: saved.markerType.label,
      markerScopeCode: saved.markerScope.code,
      markerScope: saved.markerScope.label,
      condition: saved.condition.code,
    } : candidate),
  };
}

export function appendHeadstoneSummary(data: CemeteryData, summary: HeadstoneSummary) {
  const headstones = data.headstones ?? [];
  return {
    ...data,
    headstones: headstones.some((candidate) => candidate.id === summary.id)
      ? headstones.map((candidate) => candidate.id === summary.id ? summary : candidate)
      : [...headstones, summary],
  };
}

export function replaceBurialInGrave(grave: GraveSpace | undefined, saved: Burial) {
  if (!grave) return grave;
  return { ...grave, burials: grave.burials.map((candidate) => candidate.id === saved.id ? saved : candidate) };
}

export function assignLotInMapData(data: CemeteryData, selected: GraveSpaceSummary, lotId: string) {
  const selectedKey = graveKey(selected);
  return {
    ...data,
    graves: data.graves.map((grave) => graveKey(grave) === selectedKey ? { ...grave, lot: lotId } : grave),
  };
}

export function assignLotToSelectedGrave(current: GraveSpaceSummary | undefined, selected: GraveSpaceSummary, lotId: string) {
  return current && graveKey(current) === graveKey(selected) ? { ...current, lot: lotId } : current;
}

export function removeFeatureFromGrave(grave: GraveSpace | undefined, featureId: string) {
  if (!grave) return grave;
  return {
    ...grave,
    features: (grave.features ?? []).filter((feature) => feature.id !== featureId),
    headstones: grave.headstones.map((headstone) => ({
      ...headstone,
      features: (headstone.features ?? []).filter((feature) => feature.id !== featureId),
    })),
  };
}

export function removeFeatureFromHeadstone(headstone: Headstone | undefined, featureId: string) {
  return headstone ? { ...headstone, features: (headstone.features ?? []).filter((feature) => feature.id !== featureId) } : headstone;
}

export function removeMediaAsset<T extends { mediaAssets: MediaAsset[] } | undefined>(record: T, assetId: string): T {
  return record ? { ...record, mediaAssets: record.mediaAssets.filter((asset) => asset.id !== assetId) } as T : record;
}

export function moveMediaAssetInRecord<T extends { mediaAssets: MediaAsset[] } | undefined>(record: T, assetId: string, direction: "earlier" | "later"): T {
  if (!record) return record;
  const mediaAssets = [...record.mediaAssets];
  const currentIndex = mediaAssets.findIndex((asset) => asset.id === assetId);
  const swapIndex = currentIndex + (direction === "earlier" ? -1 : 1);
  if (currentIndex < 0 || swapIndex < 0 || swapIndex >= mediaAssets.length) return record;
  [mediaAssets[currentIndex], mediaAssets[swapIndex]] = [mediaAssets[swapIndex], mediaAssets[currentIndex]];
  return { ...record, mediaAssets } as T;
}
