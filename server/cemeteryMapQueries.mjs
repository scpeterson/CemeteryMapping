import { sectionAlternateNamesSelect } from "./cemeterySchema.mjs";

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
