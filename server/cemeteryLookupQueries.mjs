import { headstoneCemeteryIdSql, headstoneCemeteryJoinsSql } from "./headstoneCemeterySql.mjs";

import { graveFeatureTablesExist } from "./cemeteryFeatureQueries.mjs";
import { maintenanceTablesExist } from "./cemeteryMaintenanceQueries.mjs";

export async function listHeadstoneLookupOptions(pool, { allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    const markerTypes = await client.query("SELECT id::text, code, label FROM marker_types WHERE is_active ORDER BY lower(label), label, code");
    const markerScopes = await client.query("SELECT id::text, code, label FROM marker_scope_types WHERE is_active ORDER BY lower(label), label, code");
    const materials = await client.query("SELECT id::text, code, label FROM marker_material_types WHERE is_active ORDER BY lower(label), label, code");
    const conditions = await client.query("SELECT id::text, code, label FROM headstone_condition_types WHERE is_active ORDER BY lower(label), label, code");
    const vaseTypes = await client.query("SELECT id::text, code, label FROM headstone_vase_types WHERE is_active ORDER BY lower(label), label, code");
    const vaseMaterials = await client.query("SELECT id::text, code, label FROM headstone_vase_material_types WHERE is_active ORDER BY lower(label), label, code");
    const vasePlacements = await client.query("SELECT id::text, code, label FROM headstone_vase_placement_types WHERE is_active ORDER BY lower(label), label, code");
    const graveFeatureLookupExists = await graveFeatureTablesExist(client);
    const graveFeatureTypes = graveFeatureLookupExists ? await client.query("SELECT id::text, code, label FROM grave_feature_types WHERE is_active ORDER BY lower(label), label, code") : { rows: [] };
    const graveFeatureSubtypes = graveFeatureLookupExists
      ? await client.query(`
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
    const graveFeaturePlacements = graveFeatureLookupExists ? await client.query("SELECT id::text, code, label FROM grave_feature_placement_types WHERE is_active ORDER BY lower(label), label, code") : { rows: [] };
    const graveFeatureMaterials = graveFeatureLookupExists ? await client.query("SELECT id::text, code, label FROM grave_feature_material_types WHERE is_active ORDER BY lower(label), label, code") : { rows: [] };
    const intermentTypes = await client.query("SELECT id::text, code, label FROM burial_interment_types WHERE is_active ORDER BY lower(label), label, code");
    const burialRecordStatuses = await client.query("SELECT id::text, code, label FROM burial_record_status_types WHERE is_active ORDER BY lower(label), label, code");
    const militaryBranches = await client.query("SELECT id::text, code, label FROM military_branch_types WHERE is_active ORDER BY lower(label), label, code");
    const militaryRanks = await client.query(`
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
    const militaryWarServices = await client.query("SELECT id::text, code, label FROM military_war_service_types WHERE is_active ORDER BY lower(label), label, code");
    const militaryDecorations = await client.query("SELECT id::text, code, label FROM military_decoration_types WHERE is_active ORDER BY lower(label), label, code");
    const verifiedPlaces = await client.query(`
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
    const maintenanceLookupExists = await maintenanceTablesExist(client);
    const maintenanceIssueTypes = maintenanceLookupExists ? await client.query("SELECT id::text, code, label FROM maintenance_issue_types WHERE is_active ORDER BY lower(label), label, code") : { rows: [] };
    const maintenanceActionTypes = maintenanceLookupExists ? await client.query("SELECT id::text, code, label FROM maintenance_action_types WHERE is_active ORDER BY lower(label), label, code") : { rows: [] };
    const maintenancePriorities = maintenanceLookupExists ? await client.query("SELECT id::text, code, label FROM maintenance_priority_types WHERE is_active ORDER BY lower(label), label, code") : { rows: [] };
    const headstones = await client.query(
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
    );
    const gravesites = await client.query(
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
    );

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
