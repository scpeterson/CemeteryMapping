import { headstoneCemeteryIdSql, headstoneCemeteryJoinsSql } from "./headstoneCemeterySql.mjs";

import { batchedReadQueries } from "./queryBatch.mjs";

export async function listHeadstoneLookupOptions(pool, { allowedCemeteryIds, includeEntities = true } = {}) {
  const client = await pool.connect();
  try {
    const { read, execute } = batchedReadQueries(client);
    const markerTypes = read("SELECT id::text, code, label FROM marker_types WHERE is_active ORDER BY lower(label), label, code");
    const markerScopes = read("SELECT id::text, code, label FROM marker_scope_types WHERE is_active ORDER BY lower(label), label, code");
    const materials = read("SELECT id::text, code, label FROM marker_material_types WHERE is_active ORDER BY lower(label), label, code");
    const conditions = read("SELECT id::text, code, label FROM headstone_condition_types WHERE is_active ORDER BY lower(label), label, code");
    const vaseTypes = read("SELECT id::text, code, label FROM headstone_vase_types WHERE is_active ORDER BY lower(label), label, code");
    const vaseMaterials = read("SELECT id::text, code, label FROM headstone_vase_material_types WHERE is_active ORDER BY lower(label), label, code");
    const vasePlacements = read("SELECT id::text, code, label FROM headstone_vase_placement_types WHERE is_active ORDER BY lower(label), label, code");
    const graveFeatureLookupExists = true;
    const graveFeatureTypes = graveFeatureLookupExists ? read("SELECT id::text, code, label FROM grave_feature_types WHERE is_active ORDER BY lower(label), label, code") : { rows: [] };
    const graveFeatureSubtypes = graveFeatureLookupExists
      ? read(`
          SELECT
            grave_feature_subtypes.id::text,
            grave_feature_subtypes.code,
            grave_feature_subtypes.label,
            grave_feature_types.code AS "featureTypeCode"
          FROM grave_feature_subtypes
          LEFT JOIN grave_feature_types
            ON grave_feature_types.id = grave_feature_subtypes.grave_feature_type_id
          WHERE grave_feature_subtypes.is_active
          ORDER BY lower(grave_feature_types.label), lower(grave_feature_subtypes.label), grave_feature_subtypes.code
        `)
      : { rows: [] };
    const graveFeaturePlacements = graveFeatureLookupExists ? read("SELECT id::text, code, label FROM grave_feature_placement_types WHERE is_active ORDER BY lower(label), label, code") : { rows: [] };
    const graveFeatureMaterials = graveFeatureLookupExists ? read("SELECT id::text, code, label FROM grave_feature_material_types WHERE is_active ORDER BY lower(label), label, code") : { rows: [] };
    const intermentTypes = read("SELECT id::text, code, label FROM burial_interment_types WHERE is_active ORDER BY lower(label), label, code");
    const burialRecordStatuses = read("SELECT id::text, code, label FROM burial_record_status_types WHERE is_active ORDER BY lower(label), label, code");
    const militaryBranches = read("SELECT id::text, code, label FROM military_branch_types WHERE is_active ORDER BY lower(label), label, code");
    const militaryRanks = read(`
          SELECT
            military_rank_types.id::text,
            military_rank_types.code,
            military_rank_types.label,
            military_rank_types.abbreviation,
            military_rank_types.pay_grade AS "payGrade",
            military_branch_types.code AS "militaryBranchCode"
          FROM military_rank_types
          JOIN military_branch_types
            ON military_branch_types.id = military_rank_types.military_branch_type_id
          WHERE military_rank_types.is_active
            AND military_branch_types.is_active
          ORDER BY lower(military_branch_types.label), lower(military_rank_types.label), military_rank_types.code
        `);
    const militaryWarServices = read("SELECT id::text, code, label FROM military_war_service_types WHERE is_active ORDER BY lower(label), label, code");
    const militaryDecorations = read("SELECT id::text, code, label FROM military_decoration_types WHERE is_active ORDER BY lower(label), label, code");
    const verifiedPlaces = read(`
      SELECT
        id::text,
        authority_identifier AS code,
        display_name AS label,
        locality,
        administrative_area AS "administrativeArea",
        country_name AS "countryName",
        country_code AS "countryCode",
        authority_name AS "authorityName",
        authority_identifier AS "authorityIdentifier",
        authority_url AS "authorityUrl",
        verification_status AS "verificationStatus"
      FROM places
      WHERE verification_status = 'verified'
        AND is_active
        AND deleted_at IS NULL
      ORDER BY lower(display_name), display_name
    `);
    const maintenanceLookupExists = true;
    const maintenanceIssueTypes = maintenanceLookupExists ? read("SELECT id::text, code, label FROM maintenance_issue_types WHERE is_active ORDER BY lower(label), label, code") : { rows: [] };
    const maintenanceActionTypes = maintenanceLookupExists ? read("SELECT id::text, code, label FROM maintenance_action_types WHERE is_active ORDER BY lower(label), label, code") : { rows: [] };
    const maintenancePriorities = maintenanceLookupExists ? read("SELECT id::text, code, label FROM maintenance_priority_types WHERE is_active ORDER BY lower(label), label, code") : { rows: [] };
    await execute();
    const headstones = includeEntities ? await client.query(
      `
        SELECT
          headstones.id::text,
          headstones.headstone_id AS code,
          headstones.headstone_id AS label
        FROM headstones
        ${headstoneCemeteryJoinsSql}
        WHERE headstones.deleted_at IS NULL
          AND (
            $1::uuid[] IS NULL
            OR ${headstoneCemeteryIdSql} = ANY($1::uuid[])
          )
        ORDER BY headstones.headstone_id
      `,
      [Array.isArray(allowedCemeteryIds) ? allowedCemeteryIds : null],
    ) : { rows: [] };
    const gravesites = includeEntities ? await client.query(
      `
        SELECT
          gravesites.id::text,
          concat_ws('-', NULLIF(gravesites.section_id, ''), NULLIF(gravesites.grave_id, '')) AS code,
          concat(
            concat_ws('-', NULLIF(gravesites.section_id, ''), NULLIF(gravesites.grave_id, '')),
            CASE WHEN gravesites.name IS NULL OR gravesites.name = '' THEN '' ELSE concat(' — ', gravesites.name) END
          ) AS label
        FROM gravesites
        WHERE gravesites.deleted_at IS NULL
          AND ($1::uuid[] IS NULL OR gravesites.cemetery_id = ANY($1::uuid[]))
        ORDER BY gravesites.gravesite_id
      `,
      [Array.isArray(allowedCemeteryIds) ? allowedCemeteryIds : null],
    ) : { rows: [] };

    return {
      headstones: headstones.rows,
      gravesites: gravesites.rows,
      markerTypes: markerTypes.rows,
      markerScopes: markerScopes.rows,
      materials: materials.rows,
      conditions: conditions.rows,
      vaseTypes: vaseTypes.rows,
      vaseMaterials: vaseMaterials.rows,
      vasePlacements: vasePlacements.rows,
      graveFeatureTypes: graveFeatureTypes.rows,
      graveFeatureSubtypes: graveFeatureSubtypes.rows,
      graveFeaturePlacements: graveFeaturePlacements.rows,
      graveFeatureMaterials: graveFeatureMaterials.rows,
      intermentTypes: intermentTypes.rows,
      burialRecordStatuses: burialRecordStatuses.rows,
      militaryBranches: militaryBranches.rows,
      militaryRanks: militaryRanks.rows,
      militaryWarServices: militaryWarServices.rows,
      militaryDecorations: militaryDecorations.rows,
      verifiedPlaces: verifiedPlaces.rows,
      maintenanceIssueTypes: maintenanceIssueTypes.rows,
      maintenanceActionTypes: maintenanceActionTypes.rows,
      maintenancePriorities: maintenancePriorities.rows,
    };
  } finally {
    client.release();
  }
}
