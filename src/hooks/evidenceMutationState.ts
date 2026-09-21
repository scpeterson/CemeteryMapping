import type { GraveFeature, GraveSpace, Headstone, MaintenanceRecord } from "../types";

type EvidenceUpdate = { kind: "feature"; saved: GraveFeature } | { kind: "maintenance"; saved: MaintenanceRecord };
type EvidenceCollections = { features?: GraveFeature[]; maintenanceRecords?: MaintenanceRecord[] };

function updateItems<T extends { id: string }>(items: T[], saved: T, append: boolean): T[] {
  return append ? [...items, saved] : items.map((item) => item.id === saved.id ? saved : item);
}

function collectionPatch(record: EvidenceCollections, update: EvidenceUpdate, append: boolean) {
  return update.kind === "feature"
    ? { features: updateItems(record.features ?? [], update.saved, append) }
    : { maintenanceRecords: updateItems(record.maintenanceRecords ?? [], update.saved, append) };
}

export function updateEvidenceInMarker(marker: Headstone | undefined, update: EvidenceUpdate, append = false) {
  if (!marker || marker.id !== update.saved.headstoneUuid) return marker;
  return { ...marker, ...collectionPatch(marker, update, append) };
}

export function updateEvidenceInGrave(grave: GraveSpace | undefined, update: EvidenceUpdate, append = false, includeGrave = true) {
  if (!grave) return grave;
  return {
    ...grave,
    ...(includeGrave ? collectionPatch(grave, update, append) : {}),
    headstones: grave.headstones.map((marker) => updateEvidenceInMarker(marker, update, append)!),
  };
}
