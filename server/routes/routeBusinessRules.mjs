import { canEditCemetery } from "../auth.mjs";
import { BadRequestError } from "../requestValidation.mjs";

async function markerTypeCodeForId(pool, markerTypeId) {
  const result = await pool.query("SELECT code FROM marker_types WHERE id = $1", [markerTypeId]);
  return result.rows[0]?.code;
}

async function sectionNameForHeadstone(pool, headstoneId) {
  const result = await pool.query(
    `
      SELECT COALESCE(sections.name, gravesites.section_id) AS section_name
      FROM headstones
      LEFT JOIN gravesites
        ON gravesites.id = headstones.gravesite_uuid
      LEFT JOIN sections
        ON sections.section_id = gravesites.section_uuid
      WHERE headstones.id = $1
        AND headstones.deleted_at IS NULL
      LIMIT 1
    `,
    [headstoneId],
  );
  return result.rows[0]?.section_name;
}

export async function validateHeadstoneBusinessRules(pool, headstoneId, headstone) {
  const [markerTypeCode, sectionName] = await Promise.all([markerTypeCodeForId(pool, headstone.markerTypeId), sectionNameForHeadstone(pool, headstoneId)]);
  if (!markerTypeCode) throw new BadRequestError("Marker type is invalid.");
  if (String(sectionName ?? "").toUpperCase() === "G" && markerTypeCode !== "flat_marker") {
    throw new BadRequestError("Section G can contain only flat markers.");
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
