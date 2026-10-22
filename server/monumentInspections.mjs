import { isDeepStrictEqual } from "node:util";
import { BadRequestError, ConflictError } from "./requestValidation.mjs";
import { optionalText, requiredText, validateUuid } from "./inputValidation.mjs";
import { optionalDate } from "./routes/routeValidationHelpers.mjs";

function inspectionTranscription(value) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > 20000) throw new BadRequestError("Inspection inscription must be text of at most 20000 characters.");
  return value;
}

export function validateInspectionFaces(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) throw new BadRequestError("An inspection must have between 1 and 32 faces.");
  const faces = value.map(face => ({
    id: validateUuid(face?.id, "Inspection face").toLowerCase(),
    label: requiredText(face?.label, "Face label", 100),
    inscription: inspectionTranscription(face?.inscription),
  }));
  if (new Set(faces.map(f => f.id)).size !== faces.length || new Set(faces.map(f => f.label.toLowerCase())).size !== faces.length) throw new BadRequestError("Inspection faces need unique ids and labels.");
  if (JSON.stringify(faces).length > 400000) throw new BadRequestError("Combined face inscriptions are too long.");
  return faces;
}

export function validateNewInspections(value, { updating = false } = {}) {
  if (!Array.isArray(value) || value.length > 20) throw new BadRequestError("Inspections must be an array of at most 20 entries.");
  return value.map((entry) => {
    const sourceType = entry?.sourceType;
    if (!["nhg", "field_survey", "historical"].includes(sourceType)) throw new BadRequestError("Inspection source type is invalid.");
    const inspectedAt = sourceType === "nhg" ? "2005-10-11" : optionalDate(entry.inspectedAt, "Inspection date");
    const inspectionYear = inspectedAt ? Number(inspectedAt.slice(0, 4)) : entry.inspectionYear;
    if (!inspectedAt && (!updating || !Number.isInteger(inspectionYear) || inspectionYear < 1 || inspectionYear > 9999)) throw new BadRequestError("Inspection date is required.");
    const expectedUpdatedAt = updating ? requiredText(entry.expectedUpdatedAt, "Inspection version", 50) : undefined;
    if (updating && !Number.isFinite(Date.parse(expectedUpdatedAt))) throw new BadRequestError("Inspection version is invalid.");
    return { id: validateUuid(entry.id, "Inspection"), inspectedAt, inspectionYear, sourceType, ...(updating ? { expectedUpdatedAt } : {}),
      source: requiredText(entry.source, "Inspection source", 500), conditionId: validateUuid(entry.conditionId, "Inspection condition"),
      conditionNotes: optionalText(entry.conditionNotes, "Inspection condition notes", 4000) || "",
      inscription: inspectionTranscription(entry.inscription), ...(entry.faces === undefined ? {} : {faces: validateInspectionFaces(entry.faces)}) };
  });
}

export async function insertMonumentInspections(client, markerId, entries = []) {
  for (const entry of entries) {
    await client.query(`INSERT INTO monument_inspections(id,headstone_uuid,inspected_at,inspection_year,source_type,source,condition_type_id,condition_notes,inscription,faces)
      VALUES($1,$2,$3::date,extract(year FROM $3::date)::integer,$4,$5,$6,$7,$8,$9::jsonb)`,
    [entry.id, markerId, entry.inspectedAt, entry.sourceType, entry.source, entry.conditionId, entry.conditionNotes, entry.inscription, JSON.stringify(entry.faces ?? [])]);
  }
}

export function assertInspectionEditor(actorUser) {
  if (actorUser && !["admin", "cemetery-admin"].includes(actorUser.role)) {
    const error = new Error("A cemetery admin or higher is required to edit inspections.");
    error.statusCode = 403;
    throw error;
  }
}

export async function updateMonumentInspections(client, markerId, entries = []) {
  for (const entry of entries) {
    const result = await client.query(`UPDATE monument_inspections SET inspected_at=$3::date,inspection_year=$4,
      source_type=$5,source=$6,condition_type_id=$7,condition_notes=$8,inscription=$9,faces=CASE WHEN $11::jsonb IS NULL THEN faces ELSE COALESCE((SELECT jsonb_agg(
        COALESCE((SELECT old FROM jsonb_array_elements(faces) old WHERE old->>'id'=f->>'id' LIMIT 1),'{}'::jsonb) || f)
        FROM jsonb_array_elements($11::jsonb) f),'[]'::jsonb) END,
      manually_edited=true,updated_at=clock_timestamp()
      WHERE id=$1 AND headstone_uuid=$2 AND updated_at=$10::timestamptz
      AND ($11::jsonb IS NULL OR NOT EXISTS(SELECT 1 FROM monument_photo_contexts c WHERE c.inspection_id=$1 AND c.deleted_at IS NULL AND c.face_id IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements($11::jsonb) f WHERE f->>'id'=c.face_id::text))) RETURNING id`,
    [entry.id, markerId, entry.inspectedAt || null, entry.inspectionYear, entry.sourceType, entry.source,
      entry.conditionId, entry.conditionNotes, entry.inscription, entry.expectedUpdatedAt, entry.faces === undefined ? null : JSON.stringify(entry.faces)]);
    if (!result.rowCount) throw new ConflictError("This inspection changed since you opened it. Reload the marker before saving.");
  }
}

// Legacy marker editors can still write the field assessment. Apply the same
// inspection permission to those fields so older clients cannot bypass it.
export function inspectionFieldsChanged(existing, incoming) {
  const dateOnly = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').slice(0, 10);
  if (incoming.conditionId !== existing.condition_type_id
      || (incoming.conditionNotes || '') !== (existing.condition_notes || '')
      || dateOnly(incoming.lastInspectedAt) !== dateOnly(existing.last_inspected_at)) return true;
  if (incoming.historicalTranscriptions !== undefined && !isDeepStrictEqual(incoming.historicalTranscriptions, existing.historical_transcriptions ?? [])) return true;
  if (incoming.faces === undefined) {
    return (incoming.inscription || '') !== (existing.inscription || '')
      || (incoming.inscriptionStatus !== undefined && incoming.inscriptionStatus !== existing.inscription_status)
      || (incoming.currentLegibility !== undefined && incoming.currentLegibility !== existing.current_legibility);
  }
  const readings = (faces) => (faces ?? []).map((face) => ({
    id: face.id, inscription: face.inscription || '',
    status: face.inscriptionStatus || (face.inscription?.trim() ? 'transcribed' : 'not_recorded'),
    legibility: face.currentLegibility || 'unknown',
    history: face.historicalTranscriptions ?? [],
  }));
  return !isDeepStrictEqual(readings(incoming.faces), readings(existing.faces));
}
