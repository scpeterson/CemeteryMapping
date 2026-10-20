import type { Headstone, MarkerFace } from "../types";

export function isEmptyNewMarkerFace(face: MarkerFace, headstone: Headstone): boolean {
  return !headstone.faces?.some((saved) => saved.id === face.id)
    && !face.label.trim() && !face.inscription.trim() && !face.notes.trim() && !(face.designNotes ?? "").trim()
    && (!face.inscriptionStatus || face.inscriptionStatus === "not_recorded")
    && face.burialIds.length === 0 && face.mediaAssetIds.length === 0;
}

export function editableMarkerFaces(headstone: Headstone): MarkerFace[] {
  if (headstone.faces?.length) return headstone.faces;
  if (headstone.inscriptionStatus === "blank" || headstone.inscriptionStatus === "illegible") return [{
    id: crypto.randomUUID(), label: "Unspecified face", inscription: "", inscriptionStatus: headstone.inscriptionStatus,
    notes: "", burialIds: [], mediaAssetIds: [],
  }];
  if (headstone.faces !== undefined) return headstone.faces;
  return headstone.inscription ? [{ id: crypto.randomUUID(), label: "Unspecified face", inscription: headstone.inscription,
    notes: "", burialIds: [], mediaAssetIds: [] }] : [];
}
