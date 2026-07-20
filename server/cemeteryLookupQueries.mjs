import {
  burialIntermentTypeLookupExists,
  burialMilitaryBranchLookupExists,
  burialMilitaryRankLookupExists,
  burialMilitaryWarServiceLookupExists,
  burialRecordStatusColumnExists,
} from "./burialRepository.mjs";
import { graveFeatureTablesExist } from "./cemeteryFeatureQueries.mjs";
import { maintenanceTablesExist } from "./cemeteryMaintenanceQueries.mjs";

export async function listHeadstoneLookupOptions(pool, { allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    const markerTypes = await client.query("SELECT id::text, code, label FROM marker_types WHERE is_active ORDER BY sort_order, label");
    const materials = await client.query("SELECT id::text, code, label FROM marker_material_types WHERE is_active ORDER BY sort_order, label");
    const conditions = await client.query("SELECT id::text, code, label FROM headstone_condition_types WHERE is_active ORDER BY sort_order, label");
    const vaseTypes = await client.query("SELECT id::text, code, label FROM headstone_vase_types WHERE is_active ORDER BY sort_order, label");
    const vaseMaterials = await client.query("SELECT id::text, code, label FROM headstone_vase_material_types WHERE is_active ORDER BY sort_order, label");
    const vasePlacements = await client.query("SELECT id::text, code, label FROM headstone_vase_placement_types WHERE is_active ORDER BY sort_order, label");
    const graveFeatureLookupExists = await graveFeatureTablesExist(client);
    const graveFeatureTypes = graveFeatureLookupExists ? await client.query("SELECT id::text, code, label FROM grave_feature_types WHERE is_active ORDER BY sort_order, label") : { rows: [] };
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
          ORDER BY grave_feature_subtypes.sort_order, grave_feature_subtypes.label
        `)
      : { rows: [] };
    const graveFeaturePlacements = graveFeatureLookupExists ? await client.query("SELECT id::text, code, label FROM grave_feature_placement_types WHERE is_active ORDER BY sort_order, label") : { rows: [] };
    const graveFeatureMaterials = graveFeatureLookupExists ? await client.query("SELECT id::text, code, label FROM grave_feature_material_types WHERE is_active ORDER BY sort_order, label") : { rows: [] };
    const intermentTypes = (await burialIntermentTypeLookupExists(client))
      ? await client.query("SELECT id::text, code, label FROM burial_interment_types WHERE is_active ORDER BY sort_order, label")
      : {
          rows: [
            { id: "legacy-casket", code: "casket", label: "Casket" },
            { id: "legacy-urn", code: "urn", label: "Funeral urn" },
          ],
        };
    const burialRecordStatuses = (await burialRecordStatusColumnExists(client))
      ? await client.query("SELECT id::text, code, label FROM burial_record_status_types WHERE is_active ORDER BY sort_order, label")
      : { rows: [{ id: "legacy-interred", code: "interred", label: "Interred" }] };
    const militaryBranches = (await burialMilitaryBranchLookupExists(client))
      ? await client.query("SELECT id::text, code, label FROM military_branch_types WHERE is_active ORDER BY sort_order, label")
      : { rows: [] };
    const militaryRanks = (await burialMilitaryRankLookupExists(client))
      ? await client.query(`
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
          ORDER BY military_branch_types.sort_order, military_rank_types.sort_order, military_rank_types.label
        `)
      : { rows: [] };
    const militaryWarServices = (await burialMilitaryWarServiceLookupExists(client))
      ? await client.query("SELECT id::text, code, label FROM military_war_service_types WHERE is_active ORDER BY sort_order, label")
      : { rows: [] };
    const maintenanceLookupExists = await maintenanceTablesExist(client);
    const maintenanceIssueTypes = maintenanceLookupExists ? await client.query("SELECT id::text, code, label FROM maintenance_issue_types WHERE is_active ORDER BY sort_order, label") : { rows: [] };
    const maintenanceActionTypes = maintenanceLookupExists ? await client.query("SELECT id::text, code, label FROM maintenance_action_types WHERE is_active ORDER BY sort_order, label") : { rows: [] };
    const maintenancePriorities = maintenanceLookupExists ? await client.query("SELECT id::text, code, label FROM maintenance_priority_types WHERE is_active ORDER BY sort_order, label") : { rows: [] };
    const headstones = await client.query(
      `
        SELECT
          headstones.id::text,
          headstones.headstone_id AS code,
          headstones.headstone_id AS label
        FROM headstones
        LEFT JOIN gravesites AS direct_gravesite
          ON direct_gravesite.id = headstones.gravesite_uuid
         AND direct_gravesite.deleted_at IS NULL
        LEFT JOIN LATERAL (
          SELECT cemeteries.id
          FROM cemeteries
          WHERE headstones.geometry IS NOT NULL
            AND cemeteries.deleted_at IS NULL
            AND ST_Covers(cemeteries.geometry, headstones.geometry)
          ORDER BY cemeteries.name, cemeteries.id
          LIMIT 1
        ) containing_cemetery ON true
        WHERE headstones.deleted_at IS NULL
          AND (
            $1::uuid[] IS NULL
            OR COALESCE(direct_gravesite.cemetery_id, containing_cemetery.id) = ANY($1::uuid[])
          )
        ORDER BY headstones.headstone_id
      `,
      [Array.isArray(allowedCemeteryIds) ? allowedCemeteryIds : null],
    );

    return {
      headstones: headstones.rows,
      markerTypes: markerTypes.rows,
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
      maintenanceIssueTypes: maintenanceIssueTypes.rows,
      maintenanceActionTypes: maintenanceActionTypes.rows,
      maintenancePriorities: maintenancePriorities.rows,
    };
  } finally {
    client.release();
  }
}
