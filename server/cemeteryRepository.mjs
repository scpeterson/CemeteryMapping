import { selectBurialsForCemeteries } from "./cemeteryBurialQueries.mjs";
import { graveFeatureTablesExist } from "./cemeteryFeatureQueries.mjs";
import { updateGraveSpaceMutation } from "./cemeteryGraveMutations.mjs";
import { loadDetailedGrave, toDetailedGrave, toGraveSummary } from "./cemeteryGraveQueries.mjs";
import { selectHeadstoneById } from "./cemeteryHeadstoneQueries.mjs";
import { maintenanceTablesExist } from "./cemeteryMaintenanceQueries.mjs";
import { selectOwnersForCemeteries } from "./cemeteryOwnershipQueries.mjs";
import {
  selectActiveCemeteries,
  selectGravesForCemeteries,
  selectHeadstoneSummariesForCemeteries,
  selectLotRestrictedAreasForCemeteries,
  selectLotsForCemeteries,
  selectSectionsForCemeteries,
} from "./cemeteryMapQueries.mjs";
import {
  burialIntermentTypeLookupExists,
  burialMilitaryBranchLookupExists,
  burialMilitaryRankLookupExists,
  burialMilitaryWarServiceLookupExists,
  burialRecordStatusColumnExists,
} from "./burialRepository.mjs";
import {
  parseGeometry,
  toHeadstone,
  toOwner,
} from "./cemeteryMappers.mjs";

export { createOwnershipEvent } from "./cemeteryOwnershipMutations.mjs";
export { createGraveFeature, softDeleteGraveFeature, updateGraveFeature } from "./cemeteryFeatureMutations.mjs";
export { createMaintenanceRecord, updateMaintenanceRecord } from "./cemeteryMaintenanceMutations.mjs";
export { updateBurial } from "./cemeteryBurialMutations.mjs";
export { restoreGraveSpace, softDeleteGraveSpace } from "./cemeteryGraveMutations.mjs";
export { createHeadstoneForGrave, updateHeadstone } from "./cemeteryHeadstoneMutations.mjs";
export {
  createHeadstoneRelationship,
  softDeleteHeadstoneRelationship,
  updateHeadstoneRelationship,
} from "./cemeteryHeadstoneRelationshipMutations.mjs";


function toHeadstoneSummary(row) {
  const gravesiteId = row.gravesite_id ?? null;

  return {
    id: row.id,
    headstoneId: row.headstone_id,
    cemeteryId: row.cemetery_id,
    cemeteryName: row.cemetery_name,
    gravesiteId,
    graveKey: gravesiteId ? `${row.cemetery_id}:${gravesiteId}` : `${row.cemetery_id}:headstone:${row.headstone_id}`,
    label: row.headstone_id,
    markerTypeCode: row.marker_type_code ?? "unknown",
    markerType: row.marker_type_label ?? "Unknown",
    condition: row.condition_code ?? "unknown",
    geometry: parseGeometry(row.geometry),
  };
}


function groupBy(rows, key) {
  return rows.reduce((groups, row) => {
    const value = row[key];
    if (!value) return groups;
    const existing = groups.get(value) ?? [];
    existing.push(row);
    groups.set(value, existing);
    return groups;
  }, new Map());
}



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

function toBoundaryFeature(cemetery) {
  return {
    type: "Feature",
    properties: { id: cemetery.id, name: cemetery.name },
    geometry: parseGeometry(cemetery.geometry),
  };
}

function toSection(section) {
  return {
    id: section.section_id,
    name: section.name,
    alternateNames: section.alternate_names ?? [],
    geometry: parseGeometry(section.geometry),
  };
}

function toLot(lot) {
  return {
    id: lot.lot_id,
    cemeteryId: lot.cemetery_id,
    name: lot.name,
    section: lot.section_id ?? "",
    block: lot.block_id ?? undefined,
    burialUseStatus: lot.burial_use_status ?? "standard",
    burialUseNotes: lot.burial_use_notes ?? undefined,
    geometryType: lot.geometry_type ?? "operational",
    geometrySource: lot.geometry_source ?? undefined,
    geometryConfidence: lot.geometry_confidence ?? "estimated",
    geometryNotes: lot.geometry_notes ?? undefined,
    geometry: parseGeometry(lot.geometry),
  };
}

function toLotRestrictedArea(area) {
  return {
    id: area.id,
    lotId: area.lot_id,
    cemeteryId: area.cemetery_id,
    lotName: area.lot_name,
    restrictionType: area.restriction_type ?? "non_burial",
    name: area.name,
    notes: area.notes ?? undefined,
    geometry: parseGeometry(area.geometry),
  };
}


export async function getCemeteryData(pool) {
  const client = await pool.connect();
  try {
    const cemeteries = await selectActiveCemeteries(client);
    const cemeteryIds = cemeteries.map((cemetery) => cemetery.id);
    if (cemeteryIds.length === 0) return { sections: [], lots: [], graves: [] };

    const sections = await selectSectionsForCemeteries(client, cemeteryIds);
    const lots = await selectLotsForCemeteries(client, cemeteryIds);
    const lotRestrictedAreas = await selectLotRestrictedAreasForCemeteries(client, cemeteryIds);
    const graves = await selectGravesForCemeteries(client, cemeteryIds);
    const headstones = await selectHeadstoneSummariesForCemeteries(client, cemeteryIds);

    return {
      boundaries: cemeteries.map(toBoundaryFeature),
      boundary: {
        type: "Feature",
        properties: { id: cemeteries[0].id, name: cemeteries[0].name },
        geometry: parseGeometry(cemeteries[0].geometry),
      },
      sections: sections.map(toSection),
      lots: lots.map(toLot),
      lotRestrictedAreas: lotRestrictedAreas.map(toLotRestrictedArea),
      graves: graves.map(toGraveSummary),
      headstones: headstones.map(toHeadstoneSummary),
    };
  } finally {
    client.release();
  }
}

export async function getDetailedCemeteryData(pool, { includeOwnership = true } = {}) {
  const client = await pool.connect();
  try {
    const cemeteries = await selectActiveCemeteries(client);
    const cemeteryIds = cemeteries.map((cemetery) => cemetery.id);
    if (cemeteryIds.length === 0) return { sections: [], lots: [], graves: [], owners: [] };

    const sections = await selectSectionsForCemeteries(client, cemeteryIds);
    const lots = await selectLotsForCemeteries(client, cemeteryIds);
    const lotRestrictedAreas = await selectLotRestrictedAreasForCemeteries(client, cemeteryIds);
    const graves = await selectGravesForCemeteries(client, cemeteryIds, { includeCost: true });
    const owners = includeOwnership ? await selectOwnersForCemeteries(client, cemeteryIds) : [];
    const burials = await selectBurialsForCemeteries(client, cemeteryIds);

    const ownersByGrave = groupBy(owners, "gravesite_uuid");
    const burialsByGrave = groupBy(burials, "gravesite_uuid");

    return {
      boundaries: cemeteries.map(toBoundaryFeature),
      boundary: {
        type: "Feature",
        properties: { id: cemeteries[0].id, name: cemeteries[0].name },
        geometry: parseGeometry(cemeteries[0].geometry),
      },
      sections: sections.map(toSection),
      lots: lots.map(toLot),
      lotRestrictedAreas: lotRestrictedAreas.map(toLotRestrictedArea),
      graves: graves.map((grave) => toDetailedGrave(grave, ownersByGrave.get(grave.uuid) ?? [], burialsByGrave.get(grave.uuid) ?? [], [], [], [], [], [], includeOwnership)),
      owners: owners.map(toOwner),
    };
  } finally {
    client.release();
  }
}


export async function getGraveSpace(pool, cemeteryId, gravesiteId, { includeOwnership = true } = {}) {
  const client = await pool.connect();
  try {
    return await loadDetailedGrave(client, cemeteryId, gravesiteId, includeOwnership);
  } finally {
    client.release();
  }
}

export async function updateGraveSpace(pool, cemeteryId, gravesiteId, graveSpace, options = {}) {
  return await updateGraveSpaceMutation(pool, cemeteryId, gravesiteId, graveSpace, options, loadDetailedGrave);
}

export async function getHeadstone(pool, id) {
  const client = await pool.connect();
  try {
    const headstone = await selectHeadstoneById(client, id);
    return headstone ? toHeadstone(headstone) : undefined;
  } finally {
    client.release();
  }
}
