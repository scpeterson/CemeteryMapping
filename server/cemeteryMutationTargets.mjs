import { derivedGravesiteStatusSql } from "./gravesiteStatusSql.mjs";

export async function selectGraveUpdateState(client, cemeteryId, gravesiteId) {
  const result = await client.query(
    `
      SELECT
        gravesites.id::text AS uuid,
        gravesites.cemetery_id::text,
        gravesites.name,
        gravesites.gravesite_id,
        gravesites.status_type_id::text,
        ${derivedGravesiteStatusSql()} AS status,
        gravesites.cost,
        gravesites.updated_at
      FROM gravesites
      LEFT JOIN gravesite_status_types status_type
        ON status_type.id = gravesites.status_type_id
      WHERE gravesites.cemetery_id = $1
        AND gravesites.gravesite_id = $2
        AND gravesites.deleted_at IS NULL
      FOR UPDATE OF gravesites
    `,
    [cemeteryId, gravesiteId],
  );

  return result.rows[0];
}

export async function selectHeadstoneMutationState(client, id) {
  const result = await client.query(
    `
      SELECT
        headstones.id::text,
        COALESCE(gravesite.cemetery_id, containing_cemetery.id)::text AS cemetery_id,
        headstones.headstone_id,
        headstones.marker_type_id::text,
        marker_types.code AS marker_type_code,
        headstones.material_type_id::text,
        marker_material_types.code AS material_type_code,
        headstones.condition_type_id::text,
        headstone_condition_types.code AS condition,
        headstones.vase_type_id::text,
        headstone_vase_types.code AS vase_type_code,
        headstones.vase_material_type_id::text,
        headstone_vase_material_types.code AS vase_material_type_code,
        headstones.vase_placement_type_id::text,
        headstone_vase_placement_types.code AS vase_placement_type_code,
        headstones.vase_notes,
        headstones.condition_notes,
        headstones.inscription,
        headstones.design_notes,
        headstones.back_description,
        headstones.photo_url,
        headstones.last_inspected_at,
        headstones.updated_at
      FROM headstones
      JOIN marker_types
        ON marker_types.id = headstones.marker_type_id
      JOIN marker_material_types
        ON marker_material_types.id = headstones.material_type_id
      JOIN headstone_condition_types
        ON headstone_condition_types.id = headstones.condition_type_id
      LEFT JOIN headstone_vase_types
        ON headstone_vase_types.id = headstones.vase_type_id
      LEFT JOIN headstone_vase_material_types
        ON headstone_vase_material_types.id = headstones.vase_material_type_id
      LEFT JOIN headstone_vase_placement_types
        ON headstone_vase_placement_types.id = headstones.vase_placement_type_id
      LEFT JOIN gravesites AS gravesite
        ON gravesite.id = headstones.gravesite_uuid
      LEFT JOIN LATERAL (
        SELECT cemeteries.id
        FROM cemeteries
        WHERE headstones.geometry IS NOT NULL
          AND cemeteries.deleted_at IS NULL
          AND ST_Covers(cemeteries.geometry, headstones.geometry)
        ORDER BY cemeteries.name, cemeteries.id
        LIMIT 1
      ) containing_cemetery ON true
      WHERE headstones.id = $1
        AND headstones.deleted_at IS NULL
      FOR UPDATE OF headstones
    `,
    [id],
  );

  return result.rows[0];
}

async function selectGravesiteUuid(client, cemeteryId, graveSpaceId) {
  if (!graveSpaceId) return null;

  const result = await client.query(
    `
      SELECT id::text
      FROM gravesites
      WHERE cemetery_id = $1
        AND gravesite_id = $2
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [cemeteryId, graveSpaceId],
  );

  return result.rows[0]?.id;
}

async function selectHeadstoneUuid(client, cemeteryId, headstoneId) {
  if (!headstoneId) return null;

  const result = await client.query(
    `
      SELECT headstones.id::text
      FROM headstones
      LEFT JOIN gravesites AS direct_gravesite
        ON direct_gravesite.id = headstones.gravesite_uuid
       AND direct_gravesite.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT gravesites.cemetery_id
        FROM headstone_gravesites
        JOIN gravesites
          ON gravesites.id = headstone_gravesites.gravesite_uuid
         AND gravesites.deleted_at IS NULL
        WHERE headstone_gravesites.headstone_uuid = headstones.id
          AND headstone_gravesites.deleted_at IS NULL
          AND gravesites.cemetery_id = $2
        LIMIT 1
      ) linked_gravesite ON true
      LEFT JOIN LATERAL (
        SELECT cemeteries.id
        FROM cemeteries
        WHERE headstones.geometry IS NOT NULL
          AND cemeteries.deleted_at IS NULL
          AND ST_Covers(cemeteries.geometry, headstones.geometry)
        ORDER BY cemeteries.name, cemeteries.id
        LIMIT 1
      ) containing_cemetery ON true
      WHERE headstones.id = $1
        AND headstones.deleted_at IS NULL
        AND COALESCE(direct_gravesite.cemetery_id, linked_gravesite.cemetery_id, containing_cemetery.id) = $2
      LIMIT 1
    `,
    [headstoneId, cemeteryId],
  );

  return result.rows[0]?.id;
}

export async function resolveCemeteryMutationTargets(client, cemeteryId, { graveSpaceId, headstoneId }) {
  const gravesiteUuid = await selectGravesiteUuid(client, cemeteryId, graveSpaceId);
  if (graveSpaceId && !gravesiteUuid) return undefined;

  const headstoneUuid = await selectHeadstoneUuid(client, cemeteryId, headstoneId);
  if (headstoneId && !headstoneUuid) return undefined;

  return { gravesiteUuid, headstoneUuid };
}
