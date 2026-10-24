import type { InspectionInput } from "../types";
import type { InspectionPhotoDraft } from "./inspectionPhotos";

export type InspectionDraft = InspectionInput & { photos?: InspectionPhotoDraft[]; recordSaved?: boolean };
export type InspectionRecovery = { version: 1; draft: InspectionDraft; updating: boolean; step: number; activeFaceId?: string; savedAt: string };
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const strings = (value: Record<string, unknown>, fields: string[]) => fields.every(key => typeof value[key] === "string");

export function readInspectionRecovery(key: string): InspectionRecovery | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "null");
    if (!object(value) || value.version !== 1 || typeof value.updating !== "boolean" || !Number.isInteger(value.step) || Number(value.step)<0 || Number(value.step)>2 || !object(value.draft)) return null;
    const draft = value.draft;
    if (!strings(draft,["id","inspectedAt","source","conditionId","conditionNotes","inscription"]) || !["field_survey","historical","nhg"].includes(String(draft.sourceType))) return null;
    if (draft.recordSaved !== undefined && typeof draft.recordSaved !== "boolean") return null;
    if (draft.expectedUpdatedAt !== undefined && typeof draft.expectedUpdatedAt !== "string") return null;
    if (draft.inspectionYear !== undefined && typeof draft.inspectionYear !== "number") return null;
    if (!Array.isArray(draft.faces) || !draft.faces.length || !draft.faces.every(face=>object(face)&&strings(face,["id","label","inscription"])&&(face.designNotes===undefined||typeof face.designNotes==="string"))) return null;
    if (draft.photos !== undefined && (!Array.isArray(draft.photos) || !draft.photos.every(photo=>object(photo)&&strings(photo,["id","faceId","notes","capturedAt"])&&typeof photo.file==="undefined"&&(typeof photo.mediaAssetId==="string"||typeof photo.missingFileName==="string")&&(photo.saved===undefined||typeof photo.saved==="boolean")))) return null;
    if (typeof value.savedAt !== "string" || !Number.isFinite(Date.parse(value.savedAt))) return null;
    if (value.activeFaceId !== undefined && typeof value.activeFaceId !== "string") return null;
    return value as unknown as InspectionRecovery;
  } catch { return null; }
}

export function storeInspectionRecovery(key: string, recovery: Omit<InspectionRecovery,"version"|"savedAt">) {
  const draft = {...recovery.draft,photos:recovery.draft.photos?.map(({file,...photo})=>({...photo,...(file?{missingFileName:file.name}:{})}))};
  localStorage.setItem(key,JSON.stringify({...recovery,draft,version:1,savedAt:new Date().toISOString()}));
}
