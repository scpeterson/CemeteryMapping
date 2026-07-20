import { setAuditContext } from "./auditContext.mjs";
import { auditEventIdForMutation } from "./cemeteryAudit.mjs";
import { graveFeatureTablesExist, selectFeaturesForGrave } from "./cemeteryFeatureQueries.mjs";
import { selectHeadstoneById, selectHeadstonesForGrave } from "./cemeteryHeadstoneQueries.mjs";
import { maintenanceTablesExist, selectMaintenanceForGrave } from "./cemeteryMaintenanceQueries.mjs";
import { selectGraveUpdateState } from "./cemeteryMutationTargets.mjs";
import { selectOwnersForCemeteries, selectOwnersForGrave } from "./cemeteryOwnershipQueries.mjs";
import {
  selectActiveCemeteries,
  selectGravesForCemeteries,
  selectHeadstoneSummariesForCemeteries,
  selectLotRestrictedAreasForCemeteries,
  selectLotsForCemeteries,
  selectSectionsForCemeteries,
} from "./cemeteryMapQueries.mjs";
import { recordReviewColumnsSql, tableColumnExists } from "./cemeterySchema.mjs";
import {
  activeBurialRecordStatusExists,
  activeIntermentTypeExists,
  burialIntermentTypeColumnExists,
  burialIntermentTypeLookupExists,
  burialIntermentTypeSql,
  burialMilitaryBranchLookupExists,
  burialMilitaryBranchTypeColumnExists,
  burialMilitaryRankLookupExists,
  burialMilitaryRankTypeColumnExists,
  burialMilitaryServiceColumnsExist,
  burialMilitaryServiceSql,
  burialMilitaryWarServiceLookupExists,
  burialMilitaryWarServiceTypeColumnExists,
  burialRecordedDateTextSql,
  burialRecordStatusColumnExists,
  burialRecordStatusSql,
  legacyBurialIntermentTypeColumnExists,
  legacyBurialMilitaryBranchColumnExists,
  legacyBurialMilitaryWarsColumnExists,
  splitRecordedDate,
} from "./burialRepository.mjs";
import {
  parseGeometry,
  toBurial,
  toGraveFeature,
  toHeadstone,
  toMaintenanceRecord,
  toMediaAsset,
  toNorthHillsEvidence,
  toOwner,
  toOwnershipEvent,
} from "./cemeteryMappers.mjs";
import { derivedGravesiteStatusSql } from "./gravesiteStatusSql.mjs";

export { createOwnershipEvent } from "./cemeteryOwnershipMutations.mjs";
export { createGraveFeature, softDeleteGraveFeature, updateGraveFeature } from "./cemeteryFeatureMutations.mjs";
export { createMaintenanceRecord, updateMaintenanceRecord } from "./cemeteryMaintenanceMutations.mjs";
export { createHeadstoneForGrave, updateHeadstone } from "./cemeteryHeadstoneMutations.mjs";
export {
  createHeadstoneRelationship,
  softDeleteHeadstoneRelationship,
  updateHeadstoneRelationship,
} from "./cemeteryHeadstoneRelationshipMutations.mjs";

const statusMap = new Map([
  ["available", "available"],
  ["reserved", "reserved"],
  ["occupied", "occupied"],
  ["sold", "sold"],
  ["needs_review", "needs_review"],
  ["needs review", "needs_review"],
]);

function normalizeStatus(status) {
  return statusMap.get(String(status ?? "").trim().toLowerCase()) ?? "unknown";
}

const statusCodeSelect = derivedGravesiteStatusSql;

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

function toGraveSummary(grave) {
  return {
    id: grave.gravesite_id,
    cemeteryId: grave.cemetery_id,
    cemeteryName: grave.cemetery_name,
    section: grave.section_id ?? "",
    lot: grave.lot_id ?? "",
    space: grave.grave_id,
    status: normalizeStatus(grave.status),
    hasVeteran: Boolean(grave.has_veteran),
    geometryType: grave.geometry_type ?? "operational",
    geometrySource: grave.geometry_source ?? undefined,
    geometryConfidence: grave.geometry_confidence ?? "estimated",
    geometryNotes: grave.geometry_notes ?? undefined,
    geometry: parseGeometry(grave.geometry),
  };
}

function ownershipRedactedGrave(grave) {
  return {
    ...grave,
    owners: [],
    currentOwnerIds: [],
    ownershipHistory: [],
  };
}

async function selectGraveMutationState(client, cemeteryId, gravesiteId) {
  const result = await client.query(
    `
      SELECT
        id::text AS uuid,
        cemetery_id::text,
        gravesite_id,
        deleted_at,
        deleted_by::text,
        delete_reason,
        updated_at
      FROM gravesites
      WHERE cemetery_id = $1
        AND gravesite_id = $2
      FOR UPDATE
    `,
    [cemeteryId, gravesiteId],
  );

  return result.rows[0];
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

async function selectGraveByCemeteryAndId(client, cemeteryId, gravesiteId) {
  const result = await client.query(
    `
      SELECT
        gravesites.id::text AS uuid,
        gravesites.cemetery_id::text,
        cemeteries.name AS cemetery_name,
        gravesites.section_id,
        gravesites.lot_id,
        gravesites.grave_id,
        gravesites.gravesite_id,
        ${statusCodeSelect()} AS status,
        gravesites.cost,
        gravesites.geometry_type,
        gravesites.geometry_source,
        gravesites.geometry_confidence,
        gravesites.geometry_notes,
        lots.geometry_type AS lot_geometry_type,
        lots.geometry_source AS lot_geometry_source,
        lots.geometry_confidence AS lot_geometry_confidence,
        lots.geometry_notes AS lot_geometry_notes,
        ST_AsGeoJSON(gravesites.geometry)::json AS geometry
      FROM gravesites
      JOIN cemeteries
        ON cemeteries.id = gravesites.cemetery_id
      LEFT JOIN lots
        ON lots.id = gravesites.lot_uuid
       AND lots.deleted_at IS NULL
      LEFT JOIN gravesite_status_types status_type
        ON status_type.id = gravesites.status_type_id
      WHERE gravesites.cemetery_id = $1
        AND gravesites.gravesite_id = $2
        AND gravesites.deleted_at IS NULL
        AND cemeteries.deleted_at IS NULL
      LIMIT 1
    `,
    [cemeteryId, gravesiteId],
  );

  return result.rows[0];
}

async function selectBurialMutationState(client, id) {
  const militaryServiceSql = await burialMilitaryServiceSql(client);
  const intermentTypeSql = await burialIntermentTypeSql(client);
  const recordStatusSql = await burialRecordStatusSql(client);
  const recordedDateTextSql = await burialRecordedDateTextSql(client);
  const reviewColumnsSql = await recordReviewColumnsSql(client, "burials");
  const result = await client.query(
    `
      SELECT
        burials.id::text,
        gravesites.cemetery_id::text,
        burials.gravesite_uuid::text,
        burials.first_name,
        burials.last_name,
        burials.maiden_name,
        burials.full_name,
        burials.birth_date,
        ${recordedDateTextSql.select},
        burials.death_date,
        burials.burial_date,
        ${intermentTypeSql.select},
        ${recordStatusSql.select},
        burials.funeral_home,
        ${militaryServiceSql.select},
        burials.notes,
        ${reviewColumnsSql},
        burials.updated_at
      FROM burials
      ${intermentTypeSql.join}
      ${recordStatusSql.join}
      ${militaryServiceSql.join}
      JOIN gravesites
        ON gravesites.id = burials.gravesite_uuid
      WHERE burials.id = $1
        AND burials.deleted_at IS NULL
        AND gravesites.deleted_at IS NULL
      FOR UPDATE OF burials
    `,
    [id],
  );

  return result.rows[0];
}

async function selectBurialById(client, id) {
  const militaryServiceSql = await burialMilitaryServiceSql(client);
  const intermentTypeSql = await burialIntermentTypeSql(client);
  const recordStatusSql = await burialRecordStatusSql(client);
  const recordedDateTextSql = await burialRecordedDateTextSql(client);
  const reviewColumnsSql = await recordReviewColumnsSql(client, "burials");
  const result = await client.query(
    `
      SELECT burials.id::text, burials.gravesite_uuid::text, burials.first_name, burials.last_name, burials.maiden_name, burials.full_name, burials.birth_date, ${recordedDateTextSql.select}, burials.death_date, burials.burial_date, ${intermentTypeSql.select}, ${recordStatusSql.select}, burials.funeral_home, ${militaryServiceSql.select}, burials.notes, ${reviewColumnsSql}
      FROM burials
      ${intermentTypeSql.join}
      ${recordStatusSql.join}
      ${militaryServiceSql.join}
      WHERE burials.id = $1
        AND burials.deleted_at IS NULL
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0];
}

async function selectBurialsForCemeteries(client, cemeteryIds) {
  const militaryServiceSql = await burialMilitaryServiceSql(client);
  const intermentTypeSql = await burialIntermentTypeSql(client);
  const recordStatusSql = await burialRecordStatusSql(client);
  const recordedDateTextSql = await burialRecordedDateTextSql(client);
  const reviewColumnsSql = await recordReviewColumnsSql(client, "burials");
  const result = await client.query(
    `
      SELECT burials.id::text, burials.gravesite_uuid::text, burials.first_name, burials.last_name, burials.maiden_name, burials.full_name, burials.birth_date, ${recordedDateTextSql.select}, burials.death_date, burials.burial_date, ${intermentTypeSql.select}, ${recordStatusSql.select}, burials.funeral_home, ${militaryServiceSql.select}, burials.notes, ${reviewColumnsSql}
      FROM burials
      ${intermentTypeSql.join}
      ${recordStatusSql.join}
      ${militaryServiceSql.join}
      WHERE burials.deleted_at IS NULL
        AND burials.gravesite_uuid IN (SELECT id FROM gravesites WHERE cemetery_id = ANY($1::uuid[]) AND deleted_at IS NULL)
      ORDER BY burials.burial_date DESC NULLS LAST, burials.death_date DESC NULLS LAST, burials.last_name, burials.first_name
    `,
    [cemeteryIds],
  );

  return result.rows;
}


async function selectBurialsForGrave(client, graveUuid) {
  const militaryServiceSql = await burialMilitaryServiceSql(client);
  const intermentTypeSql = await burialIntermentTypeSql(client);
  const recordStatusSql = await burialRecordStatusSql(client);
  const recordedDateTextSql = await burialRecordedDateTextSql(client);
  const reviewColumnsSql = await recordReviewColumnsSql(client, "burials");
  const result = await client.query(
    `
      SELECT burials.id::text, burials.gravesite_uuid::text, burials.first_name, burials.last_name, burials.maiden_name, burials.full_name, burials.birth_date, ${recordedDateTextSql.select}, burials.death_date, burials.burial_date, ${intermentTypeSql.select}, ${recordStatusSql.select}, burials.funeral_home, ${militaryServiceSql.select}, burials.notes, ${reviewColumnsSql}
      FROM burials
      ${intermentTypeSql.join}
      ${recordStatusSql.join}
      ${militaryServiceSql.join}
      WHERE burials.gravesite_uuid = $1
        AND burials.deleted_at IS NULL
      ORDER BY burials.burial_date DESC NULLS LAST, burials.death_date DESC NULLS LAST, burials.last_name, burials.first_name
    `,
    [graveUuid],
  );

  return result.rows;
}


async function selectNorthHillsEvidenceForGrave(client, graveUuid) {
  const result = await client.query(
    `
      SELECT
        gravesite_link.id::text,
        entry.id::text AS entry_id,
        'gravesite' AS target_type,
        gravesite_link.status,
        gravesite_link.confidence,
        entry.source_page_number,
        entry.name_text,
        entry.parsed_section_name,
        entry.parsed_row_number,
        entry.parsed_position_number,
        entry.raw_text,
        gravesite_link.notes AS review_notes,
        gravesite_link.reviewed_by_email,
        gravesite_link.reviewed_at
      FROM north_hills_ocr_entry_gravesite_links gravesite_link
      JOIN north_hills_ocr_entries entry
        ON entry.id = gravesite_link.entry_id
      WHERE gravesite_link.gravesite_uuid = $1
        AND gravesite_link.status = 'linked'
      ORDER BY entry.source_page_number NULLS LAST, entry.source_line_start, entry.id
    `,
    [graveUuid],
  );

  return result.rows;
}

async function selectMediaAssetsForGrave(client, graveUuid) {
  const result = await client.query(
    `
      SELECT
        media_assets.id::text,
        media_assets.cemetery_id::text,
        media_assets.asset_type,
        media_assets.file_url,
        media_assets.thumbnail_url,
        media_assets.original_filename,
        media_assets.content_type,
        media_assets.byte_size,
        media_assets.captured_at,
        media_assets.uploaded_at,
        media_assets.captured_by_email,
        media_assets.latitude,
        media_assets.longitude,
        media_assets.gps_accuracy,
        media_assets.device_make,
        media_assets.device_model,
        media_assets.notes,
        media_assets.source,
        media_assets.status,
        gravesite_media_assets.id::text AS media_link_id,
        'gravesite' AS media_link_type,
        gravesite_media_assets.display_order
      FROM gravesite_media_assets
      JOIN media_assets
        ON media_assets.id = gravesite_media_assets.media_asset_id
      WHERE gravesite_media_assets.gravesite_uuid = $1
        AND gravesite_media_assets.deleted_at IS NULL
        AND gravesite_media_assets.status = 'linked'
        AND media_assets.deleted_at IS NULL
        AND media_assets.status = 'linked'
      ORDER BY gravesite_media_assets.display_order, media_assets.captured_at DESC NULLS LAST, media_assets.uploaded_at DESC, media_assets.id
    `,
    [graveUuid],
  );

  return result.rows;
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

function toDetailedGrave(grave, graveOwners, graveBurials, graveHeadstones, northHillsEvidence, mediaAssets, graveFeatures, maintenanceRecords, includeOwnership) {
  const detailedGrave = {
    ...toGraveSummary(grave),
    name: grave.name ?? "",
    cost: grave.cost === null || grave.cost === undefined ? undefined : Number(grave.cost),
    owners: graveOwners.map(toOwner),
    currentOwnerIds: graveOwners.map((owner) => owner.id),
    burials: graveBurials.map(toBurial),
    headstones: graveHeadstones.map(toHeadstone),
    features: graveFeatures.map(toGraveFeature),
    maintenanceRecords: maintenanceRecords.map(toMaintenanceRecord),
    northHillsEvidence: northHillsEvidence.map(toNorthHillsEvidence),
    mediaAssets: mediaAssets.map(toMediaAsset),
    ownershipHistory: graveOwners.map(toOwnershipEvent),
    notes: grave.cost ? `Recorded cost: $${grave.cost}` : undefined,
    lotGeometryType: grave.lot_geometry_type ?? undefined,
    lotGeometrySource: grave.lot_geometry_source ?? undefined,
    lotGeometryConfidence: grave.lot_geometry_confidence ?? undefined,
    lotGeometryNotes: grave.lot_geometry_notes ?? undefined,
  };

  return includeOwnership ? detailedGrave : ownershipRedactedGrave(detailedGrave);
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
    const grave = await selectGraveByCemeteryAndId(client, cemeteryId, gravesiteId);
    if (!grave) return undefined;

    const owners = includeOwnership ? await selectOwnersForGrave(client, grave.uuid) : [];
    const burials = await selectBurialsForGrave(client, grave.uuid);
    const headstones = await selectHeadstonesForGrave(client, grave.uuid);
    const northHillsEvidence = await selectNorthHillsEvidenceForGrave(client, grave.uuid);
    const mediaAssets = await selectMediaAssetsForGrave(client, grave.uuid);
    const features = await selectFeaturesForGrave(client, grave.uuid);
    const maintenanceRecords = await selectMaintenanceForGrave(client, grave.uuid);

    return toDetailedGrave(grave, owners, burials, headstones, northHillsEvidence, mediaAssets, features, maintenanceRecords, includeOwnership);
  } finally {
    client.release();
  }
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

export async function updateGraveSpace(pool, cemeteryId, gravesiteId, graveSpace, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });
    const existing = await selectGraveUpdateState(client, cemeteryId, gravesiteId);
    if (!existing) {
      await client.query("ROLLBACK");
      return undefined;
    }
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(existing.cemetery_id)) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const updateResult = await client.query(
      `
        UPDATE gravesites
        SET name = $2,
            status_type_id = (
              SELECT id
              FROM gravesite_status_types
              WHERE code = $3
            ),
            cost = $4::numeric
        WHERE id = $1
        RETURNING
          id::text AS uuid,
          cemetery_id::text,
          name,
          gravesite_id,
          status_type_id::text,
          (
            SELECT code
            FROM gravesite_status_types
            WHERE id = gravesites.status_type_id
          ) AS status,
          cost,
          updated_at
      `,
      [existing.uuid, graveSpace.name || null, graveSpace.status, graveSpace.cost ?? null],
    );
    const updatedState = updateResult.rows[0];
    const auditEventId = await auditEventIdForMutation(client, {
      actorUser,
      action: "update",
      targetTable: "gravesites",
      targetRecordId: existing.uuid,
      previousValues: existing,
      newValues: updatedState,
      reason,
    });

    const grave = await selectGraveByCemeteryAndId(client, cemeteryId, gravesiteId);
    const owners = await selectOwnersForGrave(client, grave.uuid);
    const burials = await selectBurialsForGrave(client, grave.uuid);
    const headstones = await selectHeadstonesForGrave(client, grave.uuid);
    const northHillsEvidence = await selectNorthHillsEvidenceForGrave(client, grave.uuid);
    const mediaAssets = await selectMediaAssetsForGrave(client, grave.uuid);
    const features = await selectFeaturesForGrave(client, grave.uuid);
    const maintenanceRecords = await selectMaintenanceForGrave(client, grave.uuid);

    await client.query("COMMIT");
    return { ...toDetailedGrave(grave, owners, burials, headstones, northHillsEvidence, mediaAssets, features, maintenanceRecords, true), auditEventId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateBurial(pool, id, burial, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });
    const existing = await selectBurialMutationState(client, id);
    if (!existing) {
      await client.query("ROLLBACK");
      return undefined;
    }
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(existing.cemetery_id)) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const fullName = [burial.firstName, burial.lastName].filter(Boolean).join(" ") || null;
    const effectiveIntermentType = burial.intermentType || "casket";
    if (!(await activeIntermentTypeExists(client, effectiveIntermentType))) {
      throw new Error(`Unsupported interment type: ${effectiveIntermentType}.`);
    }
    const effectiveRecordStatusCode = burial.recordStatusCode || "interred";
    if (!(await activeBurialRecordStatusExists(client, effectiveRecordStatusCode))) {
      throw new Error(`Unsupported burial record status: ${effectiveRecordStatusCode}.`);
    }
    const hasIntermentTypeLookup = await burialIntermentTypeColumnExists(client);
    const hasLegacyIntermentTypeColumn = !hasIntermentTypeLookup && (await legacyBurialIntermentTypeColumnExists(client));
    const hasRecordStatusLookup = await burialRecordStatusColumnExists(client);
    const hasMilitaryServiceColumns = await burialMilitaryServiceColumnsExist(client);
    const recordStatusParameter = hasMilitaryServiceColumns ? 16 : 13;
    const intermentTypeSetSql = hasIntermentTypeLookup
      ? "interment_type_id = (SELECT id FROM burial_interment_types WHERE code = $9 AND is_active)"
      : hasLegacyIntermentTypeColumn
        ? "interment_type = $9"
        : "id = id";
    const recordStatusSetSql = hasRecordStatusLookup
      ? `burial_record_status_type_id = (
              SELECT id
              FROM burial_record_status_types
              WHERE code = $${recordStatusParameter}
                AND is_active
            )`
      : "";
    const intermentTypeReturnSql = hasIntermentTypeLookup
      ? `(SELECT code FROM burial_interment_types WHERE burial_interment_types.id = burials.interment_type_id) AS interment_type,
          (SELECT label FROM burial_interment_types WHERE burial_interment_types.id = burials.interment_type_id) AS interment_type_label`
      : hasLegacyIntermentTypeColumn
        ? `COALESCE(NULLIF(interment_type, ''), 'casket') AS interment_type,
          CASE WHEN interment_type = 'urn' THEN 'Funeral urn' ELSE 'Casket' END AS interment_type_label`
        : `'casket'::text AS interment_type,
          'Casket'::text AS interment_type_label`;
    const recordStatusReturnSql = hasRecordStatusLookup
      ? `(SELECT code FROM burial_record_status_types WHERE burial_record_status_types.id = burials.burial_record_status_type_id) AS record_status_code,
          (SELECT label FROM burial_record_status_types WHERE burial_record_status_types.id = burials.burial_record_status_type_id) AS record_status_label`
      : `'interred'::text AS record_status_code,
          'Interred'::text AS record_status_label`;
    const firstRecordedDateTextParameter = hasMilitaryServiceColumns
      ? hasRecordStatusLookup
        ? 17
        : 16
      : hasRecordStatusLookup
        ? 14
        : 13;
    const recordedDateTextSql = await burialRecordedDateTextSql(client, firstRecordedDateTextParameter);
    const birthDate = splitRecordedDate(burial.birthDate);
    const deathDate = splitRecordedDate(burial.deathDate);
    const reviewedBy = actorUser?.email ?? actorUser?.displayName ?? actorUser?.subject ?? "";
    const hasMilitaryBranchLookup = hasMilitaryServiceColumns && (await burialMilitaryBranchTypeColumnExists(client));
    const hasMilitaryWarServiceLookup = hasMilitaryServiceColumns && (await burialMilitaryWarServiceTypeColumnExists(client));
    const hasMilitaryRankLookup = hasMilitaryServiceColumns && (await burialMilitaryRankTypeColumnExists(client));
    const hasLegacyMilitaryBranchColumn = hasMilitaryServiceColumns && !hasMilitaryBranchLookup && (await legacyBurialMilitaryBranchColumnExists(client));
    const hasLegacyMilitaryWarsColumn = hasMilitaryServiceColumns && !hasMilitaryWarServiceLookup && (await legacyBurialMilitaryWarsColumnExists(client));
    const effectiveMilitaryBranchCode = burial.veteran ? burial.militaryBranchCode : "";
    const effectiveMilitaryWarServiceCode = burial.veteran ? burial.militaryWarServiceCode : "";
    const effectiveMilitaryRankCode = burial.veteran && effectiveMilitaryBranchCode ? burial.militaryRankCode : "";
    const militaryBranchSetSql = hasMilitaryBranchLookup
      ? "military_branch_type_id = (SELECT id FROM military_branch_types WHERE code = NULLIF($12, '') AND is_active)"
      : hasLegacyMilitaryBranchColumn
        ? "military_branch = $12"
        : "";
    const militaryWarServiceSetSql = hasMilitaryWarServiceLookup
      ? "military_war_service_type_id = (SELECT id FROM military_war_service_types WHERE code = NULLIF($13, '') AND is_active)"
      : hasLegacyMilitaryWarsColumn
        ? "military_wars = $13"
        : "";
    const militaryRankSetSql = hasMilitaryRankLookup
      ? `military_rank_type_id = (
              SELECT military_rank_types.id
              FROM military_rank_types
              JOIN military_branch_types
                ON military_branch_types.id = military_rank_types.military_branch_type_id
              WHERE military_rank_types.code = NULLIF($14, '')
                AND military_branch_types.code = NULLIF($12, '')
                AND military_rank_types.is_active
                AND military_branch_types.is_active
            )`
      : "";
    const militaryServiceAssignments = [militaryBranchSetSql, militaryWarServiceSetSql, militaryRankSetSql, "notes = $15", recordStatusSetSql].filter(Boolean);
    const militaryServiceSetSql = hasMilitaryServiceColumns
      ? militaryServiceAssignments.join(",\n            ")
      : ["notes = $12", recordStatusSetSql].filter(Boolean).join(",\n            ");
    const militaryServiceReturnSql =
      hasMilitaryServiceColumns
        ? `${hasMilitaryBranchLookup ? "(SELECT code FROM military_branch_types WHERE military_branch_types.id = burials.military_branch_type_id)" : "NULL::text"} AS military_branch_code,
          ${hasMilitaryBranchLookup ? "(SELECT label FROM military_branch_types WHERE military_branch_types.id = burials.military_branch_type_id)" : hasLegacyMilitaryBranchColumn ? "military_branch" : "NULL::text"} AS military_branch,
          ${hasMilitaryRankLookup ? "(SELECT code FROM military_rank_types WHERE military_rank_types.id = burials.military_rank_type_id)" : "NULL::text"} AS military_rank_code,
          ${hasMilitaryRankLookup ? "(SELECT label FROM military_rank_types WHERE military_rank_types.id = burials.military_rank_type_id)" : "NULL::text"} AS military_rank,
          ${hasMilitaryRankLookup ? "(SELECT abbreviation FROM military_rank_types WHERE military_rank_types.id = burials.military_rank_type_id)" : "NULL::text"} AS military_rank_abbreviation,
          ${hasMilitaryRankLookup ? "(SELECT pay_grade FROM military_rank_types WHERE military_rank_types.id = burials.military_rank_type_id)" : "NULL::text"} AS military_rank_pay_grade,
          ${hasMilitaryWarServiceLookup ? "(SELECT code FROM military_war_service_types WHERE military_war_service_types.id = burials.military_war_service_type_id)" : "NULL::text"} AS military_war_service_code,
          ${hasMilitaryWarServiceLookup ? "(SELECT label FROM military_war_service_types WHERE military_war_service_types.id = burials.military_war_service_type_id)" : hasLegacyMilitaryWarsColumn ? "military_wars" : "NULL::text"} AS military_wars`
        : `NULL::text AS military_branch_code,
          NULL::text AS military_branch,
          NULL::text AS military_rank_code,
          NULL::text AS military_rank,
          NULL::text AS military_rank_abbreviation,
          NULL::text AS military_rank_pay_grade,
          NULL::text AS military_war_service_code,
          NULL::text AS military_wars`;
    const updateValues = hasMilitaryServiceColumns
      ? [
          id,
          burial.firstName || null,
          burial.lastName || null,
          burial.maidenName || null,
          fullName,
          birthDate.date,
          deathDate.date,
          burial.burialDate || null,
          effectiveIntermentType,
          burial.funeralHome || null,
          burial.veteran ? "Yes" : "No",
          effectiveMilitaryBranchCode || null,
          effectiveMilitaryWarServiceCode || null,
          effectiveMilitaryRankCode || null,
          burial.notes || null,
        ]
      : [
          id,
          burial.firstName || null,
          burial.lastName || null,
          burial.maidenName || null,
          fullName,
          birthDate.date,
          deathDate.date,
          burial.burialDate || null,
          effectiveIntermentType,
          burial.funeralHome || null,
          burial.veteran ? "Yes" : "No",
          burial.notes || null,
        ];
    if (hasRecordStatusLookup) updateValues.push(effectiveRecordStatusCode);
    if (recordedDateTextSql.hasColumns) updateValues.push(birthDate.text, deathDate.text);
    const recordedDateAssignments = recordedDateTextSql.hasColumns ? `,\n            ${recordedDateTextSql.set}` : "";
    const hasRecordReviewColumns = await tableColumnExists(client, "burials", "data_confidence");
    const reviewReturnSql = await recordReviewColumnsSql(client, "burials");
    let reviewAssignments = "";
    if (hasRecordReviewColumns) {
      const reviewParameterStart = updateValues.length + 1;
      updateValues.push(
        burial.dataConfidence || "unknown",
        burial.reviewStatus || "unreviewed",
        burial.reviewNotes || "",
        Boolean(burial.sourceConflict),
        reviewedBy,
      );
      reviewAssignments = `,
            data_confidence = $${reviewParameterStart},
            review_status = $${reviewParameterStart + 1},
            review_notes = NULLIF($${reviewParameterStart + 2}, ''),
            source_conflict = $${reviewParameterStart + 3}::boolean,
            reviewed_by = CASE WHEN $${reviewParameterStart + 1} = 'reviewed' THEN NULLIF($${reviewParameterStart + 4}, '') ELSE reviewed_by END,
            reviewed_at = CASE
              WHEN $${reviewParameterStart + 1} = 'reviewed' AND burials.review_status <> 'reviewed' THEN now()
              WHEN $${reviewParameterStart + 1} = 'reviewed' THEN COALESCE(reviewed_at, now())
              ELSE reviewed_at
            END`;
    }
    const updateResult = await client.query(
      `
        UPDATE burials
        SET first_name = $2,
            last_name = $3,
            maiden_name = $4,
            full_name = $5,
            birth_date = $6::date,
            death_date = $7::date,
            burial_date = $8::date,
            ${intermentTypeSetSql},
            funeral_home = $10,
            veteran = $11,
            ${militaryServiceSetSql}${recordedDateAssignments}${reviewAssignments}
        WHERE id = $1
        RETURNING
          id::text,
          gravesite_uuid::text,
          first_name,
          last_name,
          maiden_name,
          full_name,
          birth_date,
          ${recordedDateTextSql.return},
          death_date,
          burial_date,
          ${intermentTypeReturnSql},
          ${recordStatusReturnSql},
          funeral_home,
          veteran,
          ${militaryServiceReturnSql},
          notes,
          ${reviewReturnSql},
          updated_at
      `,
      updateValues,
    );
    const updatedState = updateResult.rows[0];
    const auditEventId = await auditEventIdForMutation(client, {
      actorUser,
      action: "update",
      targetTable: "burials",
      targetRecordId: id,
      previousValues: existing,
      newValues: updatedState,
      reason,
    });
    const updated = await selectBurialById(client, id);

    await client.query("COMMIT");
    return { ...toBurial(updated), auditEventId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function softDeleteGraveSpace(pool, cemeteryId, gravesiteId, { actorUser, reason } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });
    const existing = await selectGraveMutationState(client, cemeteryId, gravesiteId);
    if (!existing) {
      await client.query("ROLLBACK");
      return undefined;
    }

    if (existing.deleted_at) {
      await client.query("COMMIT");
      return {
        graveSpaceId: existing.gravesite_id,
        cemeteryId: existing.cemetery_id,
        deletedAt: existing.deleted_at,
        alreadyDeleted: true,
      };
    }

    const updateResult = await client.query(
      `
        UPDATE gravesites
        SET deleted_at = now(),
            deleted_by = $3::uuid,
            delete_reason = $2
        WHERE id = $1
        RETURNING id::text AS uuid, gravesite_id, deleted_at, deleted_by::text, delete_reason, updated_at
      `,
      [existing.uuid, reason, actorUser?.id ?? null],
    );
    const updated = updateResult.rows[0];
    const auditEventId = await auditEventIdForMutation(client, {
      actorUser,
      action: "soft_delete",
      targetTable: "gravesites",
      targetRecordId: existing.uuid,
      previousValues: existing,
      newValues: updated,
      reason,
    });

    await client.query("COMMIT");
    return {
      graveSpaceId: updated.gravesite_id,
      cemeteryId: existing.cemetery_id,
      deletedAt: updated.deleted_at,
      auditEventId,
      alreadyDeleted: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function restoreGraveSpace(pool, cemeteryId, gravesiteId, { actorUser, reason } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });
    const existing = await selectGraveMutationState(client, cemeteryId, gravesiteId);
    if (!existing) {
      await client.query("ROLLBACK");
      return undefined;
    }

    if (!existing.deleted_at) {
      await client.query("COMMIT");
      return {
        graveSpaceId: existing.gravesite_id,
        cemeteryId: existing.cemetery_id,
        restored: true,
        alreadyActive: true,
      };
    }

    const updateResult = await client.query(
      `
        UPDATE gravesites
        SET deleted_at = NULL,
            deleted_by = NULL,
            delete_reason = NULL
        WHERE id = $1
        RETURNING id::text AS uuid, gravesite_id, deleted_at, deleted_by::text, delete_reason, updated_at
      `,
      [existing.uuid],
    );
    const updated = updateResult.rows[0];
    const auditEventId = await auditEventIdForMutation(client, {
      actorUser,
      action: "restore",
      targetTable: "gravesites",
      targetRecordId: existing.uuid,
      previousValues: existing,
      newValues: updated,
      reason,
    });

    await client.query("COMMIT");
    return {
      graveSpaceId: updated.gravesite_id,
      cemeteryId: existing.cemetery_id,
      restored: true,
      auditEventId,
      alreadyActive: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
