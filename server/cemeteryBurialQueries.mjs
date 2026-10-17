import { burialProjectionSql } from "./burialProjection.mjs";

export async function selectBurialsForCemeteries(client, cemeteryIds) {
  const projection = burialProjectionSql();
  const result = await client.query(
    `
      SELECT ${projection.select}, burials.source_properties
      FROM burials
      ${projection.joins}
      WHERE burials.deleted_at IS NULL
        AND burials.gravesite_uuid IN (SELECT id FROM gravesites WHERE cemetery_id = ANY($1::uuid[]) AND deleted_at IS NULL)
      ORDER BY burials.burial_date DESC NULLS LAST, burials.death_date DESC NULLS LAST, burials.last_name, burials.first_name
    `,
    [cemeteryIds],
  );

  return result.rows;
}

export async function selectBurialsForGrave(client, graveUuid) {
  const projection = burialProjectionSql();
  const result = await client.query(
    `
      SELECT ${projection.select}, burials.source_properties
      FROM burials
      ${projection.joins}
      WHERE burials.gravesite_uuid = $1
        AND burials.deleted_at IS NULL
      ORDER BY burials.burial_date DESC NULLS LAST, burials.death_date DESC NULLS LAST, burials.last_name, burials.first_name
    `,
    [graveUuid],
  );

  return result.rows;
}
