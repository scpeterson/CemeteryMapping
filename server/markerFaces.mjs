import { validateUuid } from "./inputValidation.mjs";
import { BadRequestError } from "./requestValidation.mjs";

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
      burialIds: ids(face.burialIds ?? [], "Face people"), mediaAssetIds: ids(face.mediaAssetIds ?? [], "Face photos") };
  });
  if (new Set(faces.map((f) => f.id)).size !== faces.length) throw new BadRequestError("Face ids must be unique.");
  if (new Set(faces.map((f) => f.label.toLowerCase())).size !== faces.length) throw new BadRequestError("Face labels must be unique.");
  if (JSON.stringify(faces).length > 80000) throw new BadRequestError("Combined face details are too long.");
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
