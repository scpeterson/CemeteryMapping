import { canEditCemetery } from "../auth.mjs";
import { BadRequestError } from "../requestValidation.mjs";

async function markerTypeCodeForId(pool, markerTypeId) {
  const result = await pool.query("SELECT code FROM marker_types WHERE id = $1", [markerTypeId]);
  return result.rows[0]?.code;
}

export async function validateHeadstoneBusinessRules(pool, headstoneId, headstone) {
  const markerTypeCode = await markerTypeCodeForId(pool, headstone.markerTypeId);
  if (!markerTypeCode) throw new BadRequestError("Marker type is invalid.");
  const result = await pool.query("SELECT headstone_requires_flat_marker($1) AS flat_only", [headstoneId]);
  if (result.rows[0]?.flat_only && markerTypeCode !== "flat_marker") {
    throw new BadRequestError("Location policy permits only flat markers.");
  }
}

async function cemeteryIdForSection(pool, sectionId) {
  const result = await pool.query("SELECT cemetery_id::text FROM sections WHERE section_id = $1 AND deleted_at IS NULL", [sectionId]);
  return result.rows[0]?.cemetery_id;
}

async function cemeteryIdForLot(pool, lotId) {
  const result = await pool.query("SELECT cemetery_id::text FROM lots WHERE id = $1 AND deleted_at IS NULL", [lotId]);
  return result.rows[0]?.cemetery_id;
}

export async function canEditSection(pool, user, sectionId) {
  const cemeteryId = await cemeteryIdForSection(pool, sectionId);
  return cemeteryId ? canEditCemetery(user, cemeteryId) : false;
}

export async function canEditLot(pool, user, lotId) {
  const cemeteryId = await cemeteryIdForLot(pool, lotId);
  return cemeteryId ? canEditCemetery(user, cemeteryId) : false;
}
