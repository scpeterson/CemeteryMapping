import type { InspectionFace } from "../types";
import { normalizeInscriptionPlaceholder } from "../../shared/inscriptionStatus.mjs";

export const combinedInspectionReading = (faces: InspectionFace[]) => faces.length === 1
  ? faces[0].inscription : faces.map(face => `${face.label}\n${face.inscription}`).join("\n\n");
export const isCombinedInspectionReading = (text: string, faces: InspectionFace[] = []) =>
  faces.length > 0 && text === combinedInspectionReading(faces);

// Copy reading evidence, never photo/people associations. Historical entries and
// structured legibility belong to the snapshot and must survive a new draft.
export function inspectionDraftFaces(inscription: string, faces: InspectionFace[] = []): InspectionFace[] {
  return (faces.length ? faces : [{ id: crypto.randomUUID(), label: "Front", inscription }]).map(
    face => normalizeInscriptionPlaceholder({ ...face, burialIds: undefined, mediaAssetIds: undefined }));
}

export function inspectionDraftReading(inscription: string, faces?: InspectionFace[]) {
  const copied = inspectionDraftFaces(inscription, faces);
  return { faces: copied, inscription: isCombinedInspectionReading(inscription, faces)
    ? combinedInspectionReading(copied) : inscription };
}
