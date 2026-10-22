import { legibilityValues } from "../shared/inscriptionHistory.mjs";
import { inscriptionStatuses, inscriptionAllowsText } from "../shared/inscriptionStatus.mjs";
import { validateUuid } from "./inputValidation.mjs";
import { BadRequestError } from "./requestValidation.mjs";

export function validateInscriptionStatus(status, inscription) {
  if (status === undefined) return undefined;
  if (!inscriptionStatuses.includes(status)) throw new BadRequestError("Invalid inscription status.");
  if (!inscriptionAllowsText(status) && String(inscription ?? "").length) throw new BadRequestError("Blank or Illegible inscriptions cannot contain text.");
  if (status === "not_recorded" && String(inscription ?? "").trim()) throw new BadRequestError("Not recorded inscriptions cannot contain text.");
  return status;
}

export function validateCurrentLegibility(value, inscription) {
  if (value === undefined) return undefined;
  if (!legibilityValues.includes(value)) throw new BadRequestError("Invalid current legibility.");
  if (["blank", "illegible"].includes(value) && String(inscription ?? "").length) throw new BadRequestError("Blank or Illegible current inscriptions cannot contain text.");
  return value;
}
export function validateHistoricalTranscriptions(value) {
  if (!Array.isArray(value) || value.length > 100) throw new BadRequestError("Historical transcriptions must be a list of at most 100 entries.");
  const entries = value.map((entry) => {
    if (!entry || typeof entry !== "object") throw new BadRequestError("Invalid historical transcription.");
    const transcription = text(entry.text, "Historical transcription", 20000);
    const source = text(entry.source, "Historical transcription source", 500);
    const sourceDate = text(entry.sourceDate, "Historical source date", 10);
    if (!transcription.trim() || !source.trim()) throw new BadRequestError("Historical transcriptions need text and a source.");
    if (sourceDate && !/^(?:\d{4}|\d{4}-\d{2}-\d{2})$/u.test(sourceDate)) throw new BadRequestError("Historical source date must be a year or date (YYYY-MM-DD).");
    if (sourceDate && Number(sourceDate.slice(0, 4)) < 1) throw new BadRequestError("Historical source year must be positive.");
    if (sourceDate.length === 10) {
      const date = new Date(sourceDate + "T00:00:00Z");
      if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== sourceDate) throw new BadRequestError("Historical source date must be a valid calendar date.");
    }
    return { id: validateUuid(entry.id, "Historical transcription id"), text: transcription, source, sourceDate: /\b(?:NHG|North Hills Genealogists)\b/iu.test(source) ? "2005-10-11" : sourceDate,
      ...(entry.faceId ? { faceId: validateUuid(entry.faceId, "Historical face id") } : {}),
      ...(entry.faceLabel ? { faceLabel: text(entry.faceLabel, "Historical face label", 100) } : {}) };
  });
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length || JSON.stringify(entries).length > 200000) throw new BadRequestError("Historical transcriptions have duplicate ids or exceed the size limit.");
  return entries;
}

function text(value, label, max) {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > max) throw new BadRequestError(`${label} must be text of at most ${max} characters.`);
  return value;
}
function ids(value, label) {
  if (!Array.isArray(value) || value.length > 200) throw new BadRequestError(`${label} must be a list of at most 200 records.`);
  const result = value.map((id) => validateUuid(id, label).toLowerCase());
  if (new Set(result).size !== result.length) throw new BadRequestError(`${label} contains duplicates.`);
  return result;
}
export function validateMarkerFaces(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 32) throw new BadRequestError("A marker may have up to 32 faces.");
  const faces = value.map((face) => {
    if (!face || typeof face !== "object" || Array.isArray(face)) throw new BadRequestError("Invalid marker face.");
    const label = text(face.label, "Face label", 100).trim();
    if (!label) throw new BadRequestError("Each face needs a label.");
    return { id: validateUuid(face.id, "Face id").toLowerCase(), label,
      inscription: text(face.inscription, "Face inscription", 20000), notes: text(face.notes, "Face notes", 4000),
      ...(face.currentLegibility === undefined ? {} : { currentLegibility: validateCurrentLegibility(face.currentLegibility, face.inscription) }),
      ...(face.historicalTranscriptions === undefined ? {} : { historicalTranscriptions: validateHistoricalTranscriptions(face.historicalTranscriptions) }),
      ...(face.inscriptionStatus === undefined ? {} : { inscriptionStatus: validateInscriptionStatus(face.inscriptionStatus, face.inscription) }),
      ...(face.designNotes === undefined ? {} : { designNotes: text(face.designNotes, "Face design notes", 20000) }),
      burialIds: ids(face.burialIds ?? [], "Face people"), mediaAssetIds: ids(face.mediaAssetIds ?? [], "Face photos") };
  });
  if (new Set(faces.map((f) => f.id)).size !== faces.length) throw new BadRequestError("Face ids must be unique.");
  if (new Set(faces.map((f) => f.label.toLowerCase())).size !== faces.length) throw new BadRequestError("Face labels must be unique.");
  if (JSON.stringify(faces).length > 400000) throw new BadRequestError("Combined face details are too long.");
  return faces;
}
export function validateFacesRevision(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new BadRequestError("Face revision is required. Reload the marker and try again.");
  return value;
}
export async function validateFaceReferences(client, markerId, faces) {
  const burialIds = [...new Set(faces.flatMap((f) => f.burialIds))];
  const mediaIds = [...new Set(faces.flatMap((f) => f.mediaAssetIds))];
  if (burialIds.length) {
    const result = await client.query(`SELECT b.id::text FROM burials b JOIN headstone_burials hb ON hb.burial_uuid=b.id
      WHERE hb.headstone_uuid=$1 AND hb.deleted_at IS NULL AND b.deleted_at IS NULL AND b.id=ANY($2::uuid[])`, [markerId, burialIds]);
    if (new Set(result.rows.map((r) => r.id)).size !== burialIds.length) throw new BadRequestError("Face people must be active burial records linked to this marker.");
  }
  if (mediaIds.length) {
    const result = await client.query(`SELECT m.id::text FROM media_assets m JOIN headstone_media_assets hm ON hm.media_asset_id=m.id
      WHERE hm.headstone_uuid=$1 AND hm.deleted_at IS NULL AND hm.status='linked' AND m.deleted_at IS NULL
        AND m.status='linked' AND m.asset_type='photo' AND m.id=ANY($2::uuid[])`, [markerId, mediaIds]);
    if (new Set(result.rows.map((r) => r.id)).size !== mediaIds.length) throw new BadRequestError("Face photos must be active photos linked to this marker.");
  }
}
