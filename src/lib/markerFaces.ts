import type { Headstone, MarkerFace } from "../types";

export function isEmptyNewMarkerFace(face: MarkerFace, headstone: Headstone): boolean {
  return !headstone.faces?.some((saved) => saved.id === face.id)
    && !face.label.trim() && !face.inscription.trim() && !face.notes.trim() && !(face.designNotes ?? "").trim()
    && (!face.historicalTranscriptions?.length) && (!face.currentLegibility || face.currentLegibility === "unknown")
    && (!face.inscriptionStatus || face.inscriptionStatus === "not_recorded")
    && face.burialIds.length === 0 && face.mediaAssetIds.length === 0;
}

export function editableMarkerFaces(headstone: Headstone): MarkerFace[] {
  if (headstone.faces?.length) return headstone.faces;
  return [{
    id: crypto.randomUUID(), label: "Front", inscription: headstone.inscription ?? "",
    inscriptionStatus: headstone.inscriptionStatus, currentLegibility: headstone.currentLegibility,
    historicalTranscriptions: headstone.historicalTranscriptions?.filter(entry => !entry.faceId),
    notes: "", burialIds: [], mediaAssetIds: [],
  }];
}
