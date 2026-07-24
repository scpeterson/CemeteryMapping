import { sectionAlternateNamesSelect } from "./cemeterySchema.mjs";
import { derivedGravesiteStatusSql } from "./gravesiteStatusSql.mjs";

export async function selectActiveCemeteries(client) {
  const result = await client.query(`
    SELECT id::text, name, ST_AsGeoJSON(geometry)::json AS geometry
    FROM cemeteries
    WHERE deleted_at IS NULL
    ORDER BY name, id
  `);
  return result.rows;
}

export async function selectSectionsForCemeteries(client, cemeteryIds) {
  const alternateNamesSelect = await sectionAlternateNamesSelect(client);
  const result = await client.query(
    `
      SELECT section_id::text AS uuid, name AS section_id, name, ${alternateNamesSelect}, ST_AsGeoJSON(geometry)::json AS geometry
      FROM sections
      WHERE cemetery_id = ANY($1::uuid[]) AND deleted_at IS NULL AND geometry IS NOT NULL
      ORDER BY name, section_id
    `,
    [cemeteryIds],
  );
  return result.rows;
}

export async function selectLotsForCemeteries(client, cemeteryIds) {
  const result = await client.query(
    `
      SELECT lots.id::text, lots.cemetery_id::text, lot_id, section_id, block_id, COALESCE(name, lot_id) AS name,
        geometry_type, geometry_source, geometry_confidence, geometry_notes, burial_use_status, burial_use_notes,
        ST_AsGeoJSON(geometry)::json AS geometry
      FROM lots
      WHERE cemetery_id = ANY($1::uuid[]) AND deleted_at IS NULL
      ORDER BY section_id, block_id, lot_id, name
    `,
    [cemeteryIds],
  );
  return result.rows;
}

export async function selectLotRestrictedAreasForCemeteries(client, cemeteryIds) {
  const result = await client.query(
    `
      SELECT lot_restricted_areas.id::text, lots.lot_id, lots.cemetery_id::text, COALESCE(lots.name, lots.lot_id) AS lot_name,
        lot_restricted_areas.restriction_type, lot_restricted_areas.name, lot_restricted_areas.notes,
        ST_AsGeoJSON(lot_restricted_areas.geometry)::json AS geometry
      FROM lot_restricted_areas JOIN lots ON lots.id = lot_restricted_areas.lot_uuid
      WHERE lots.cemetery_id = ANY($1::uuid[]) AND lots.deleted_at IS NULL AND lot_restricted_areas.deleted_at IS NULL
      ORDER BY lots.section_id, lots.lot_id, lot_restricted_areas.name
    `,
    [cemeteryIds],
  );
  return result.rows;
}

export async function selectGravesForCemeteries(client, cemeteryIds, { includeCost = false } = {}) {
  const result = await client.query(
    `
      WITH veteran_burials AS MATERIALIZED (
        SELECT gravesite_uuid, gravesite_id
        FROM burials
        WHERE deleted_at IS NULL
          AND lower(btrim(coalesce(veteran, ''))) IN ('yes', 'y', 'true', '1', 'veteran')
      ),
      veteran_gravesite_uuids AS (
        SELECT DISTINCT gravesite_uuid
        FROM veteran_burials
        WHERE gravesite_uuid IS NOT NULL
      ),
      veteran_legacy_ids AS (
        SELECT DISTINCT gravesite_id
        FROM veteran_burials
        WHERE gravesite_uuid IS NULL AND gravesite_id IS NOT NULL
      )
      SELECT
        ${includeCost ? "gravesites.id::text AS uuid," : ""}
        gravesites.cemetery_id::text, cemeteries.name AS cemetery_name, gravesites.section_id,
        gravesites.lot_id, gravesites.grave_id, gravesites.gravesite_id, gravesites.name,
        ${derivedGravesiteStatusSql()} AS status,
        gravesites.geometry_type, gravesites.geometry_source, gravesites.geometry_confidence, gravesites.geometry_notes,
        (veteran_gravesite_uuids.gravesite_uuid IS NOT NULL OR veteran_legacy_ids.gravesite_id IS NOT NULL) AS has_veteran,
        ${includeCost ? "gravesites.cost," : ""}
        ST_AsGeoJSON(gravesites.geometry)::json AS geometry
      FROM gravesites
      JOIN cemeteries ON cemeteries.id = gravesites.cemetery_id
      LEFT JOIN gravesite_status_types status_type ON status_type.id = gravesites.status_type_id
      LEFT JOIN veteran_gravesite_uuids ON veteran_gravesite_uuids.gravesite_uuid = gravesites.id
      LEFT JOIN veteran_legacy_ids ON veteran_legacy_ids.gravesite_id = gravesites.gravesite_id
      WHERE gravesites.cemetery_id = ANY($1::uuid[]) AND gravesites.deleted_at IS NULL
      ORDER BY cemeteries.name, gravesites.section_id, gravesites.lot_id, gravesites.grave_id, gravesites.gravesite_id
    `,
    [cemeteryIds],
  );
  return result.rows;
}

export async function selectHeadstoneSummariesForCemeteries(client, cemeteryIds) {
  const result = await client.query(
    `
      SELECT headstones.id::text, headstones.headstone_id, cemeteries.id::text AS cemetery_id,
        cemeteries.name AS cemetery_name, gravesites.gravesite_id, marker_types.code AS marker_type_code,
        marker_types.label AS marker_type_label, headstone_condition_types.code AS condition_code,
        ST_AsGeoJSON(headstones.geometry)::json AS geometry
      FROM headstones
      LEFT JOIN gravesites ON gravesites.id = headstones.gravesite_uuid AND gravesites.deleted_at IS NULL
      JOIN LATERAL (
        SELECT cemeteries.id, cemeteries.name FROM cemeteries
        WHERE cemeteries.deleted_at IS NULL AND cemeteries.id = ANY($1::uuid[])
          AND (cemeteries.id = gravesites.cemetery_id OR (
            gravesites.id IS NULL AND cemeteries.geometry IS NOT NULL AND ST_Covers(cemeteries.geometry, headstones.geometry)
          ))
        ORDER BY CASE WHEN cemeteries.id = gravesites.cemetery_id THEN 0 ELSE 1 END, cemeteries.name
        LIMIT 1
      ) cemeteries ON TRUE
      JOIN marker_types ON marker_types.id = headstones.marker_type_id
      JOIN headstone_condition_types ON headstone_condition_types.id = headstones.condition_type_id
      WHERE headstones.deleted_at IS NULL AND headstones.geometry IS NOT NULL
      ORDER BY cemeteries.name, COALESCE(gravesites.gravesite_id, headstones.headstone_id), headstones.headstone_id
    `,
    [cemeteryIds],
  );
  return result.rows;
}
