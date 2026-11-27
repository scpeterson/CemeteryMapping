import { graveStackSelect } from './graveStacks.mjs';
import { runBoundedQueries } from "./queryBatch.mjs";
import { selectBurialsForGrave } from "./cemeteryBurialQueries.mjs";
import { selectFeaturesForGrave } from "./cemeteryFeatureQueries.mjs";
import { selectHeadstonesForGrave } from "./cemeteryHeadstoneQueries.mjs";
import { selectMaintenanceForGrave } from "./cemeteryMaintenanceQueries.mjs";
import { selectOwnersForGrave } from "./cemeteryOwnershipQueries.mjs";
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

export function toGraveSummary(grave) {
  return {
    id: grave.gravesite_id,
    cemeteryId: grave.cemetery_id,
    cemeteryName: grave.cemetery_name,
    section: grave.section_id ?? "",
    locationPolicies: grave.location_policies ?? {},
    lot: grave.lot_id ?? "",
    space: grave.grave_id,
    ...(grave.display_label ? { displayLabel: grave.display_label, labelAliases: grave.label_aliases ?? [] } : {}),
    stackGroup: grave.stack_group ?? undefined,
    stackLevel: grave.stack_level ?? undefined,
    stackTopLevel: grave.stack_top_level ?? undefined,
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
async function selectGraveByCemeteryAndId(client, cemeteryId, gravesiteId) {
  const result = await client.query(
    `
      SELECT
        gravesites.id::text AS uuid,
        gravesites.cemetery_id::text, gravesite_location_policies(gravesites.id) AS location_policies,
        cemeteries.name AS cemetery_name,
        CASE WHEN cemeteries.facility_id = '1' THEN jsonb_build_object(
          'burial', CASE WHEN b.gravesite_uuid IS NOT NULL THEN jsonb_build_object(
            'ashesOnly', b.max_ashes_without_casket, 'ashesWithCasket', b.max_ashes_with_casket
          ) END,
          'markerWidth', m.max_width_inches
        ) END AS approved_exceptions,
        gravesites.section_id,
        COALESCE(lots.lot_id, gravesites.lot_id) AS lot_id,
        gravesites.grave_id,
        gravesites.display_label,
        gravesites.label_aliases,
        gravesites.gravesite_id,
        ${statusCodeSelect()} AS status,
        gravesites.name,
        gravesites.xmin::text AS version,
        gravesites.cost,
        ${graveStackSelect}, gravesites.stacking_authorized_on::text, gravesites.stacking_authorization_reference,
        gravesites.geometry_type,
        gravesites.geometry_source,
        gravesites.geometry_confidence,
        gravesites.geometry_notes,
        lots.area_type AS lot_area_type,
        lots.geometry_type AS lot_geometry_type,
        lots.geometry_source AS lot_geometry_source,
        lots.geometry_confidence AS lot_geometry_confidence,
        lots.geometry_notes AS lot_geometry_notes,
        ST_AsGeoJSON(gravesites.geometry)::json AS geometry
      FROM gravesites
      JOIN cemeteries
        ON cemeteries.id = gravesites.cemetery_id
      LEFT JOIN burial_capacity_exceptions b ON b.gravesite_uuid = gravesites.id
      LEFT JOIN marker_width_exceptions m ON m.gravesite_uuid = gravesites.id
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
        entry.parse_notes,
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
        gravesite_media_assets.display_order,
        gravesite_media_assets.is_primary
      FROM gravesite_media_assets
      JOIN media_assets
        ON media_assets.id = gravesite_media_assets.media_asset_id
      WHERE gravesite_media_assets.gravesite_uuid = $1
        AND gravesite_media_assets.deleted_at IS NULL
        AND gravesite_media_assets.status = 'linked'
        AND media_assets.deleted_at IS NULL
        AND media_assets.status = 'linked'
        AND media_assets.file_url NOT LIKE '/api/cemeteries/%/grave-spaces/%/deeds/%'
      ORDER BY gravesite_media_assets.display_order, media_assets.captured_at DESC NULLS LAST, media_assets.uploaded_at DESC, media_assets.id
    `,
    [graveUuid],
  );

  return result.rows;
}
export function toDetailedGrave(grave, graveOwners, graveBurials, graveHeadstones, northHillsEvidence, mediaAssets, graveFeatures, maintenanceRecords, includeOwnership) {
  const ownershipHistoryById = new Map();
  for (const owner of graveOwners) {
    const event = toOwnershipEvent(owner);
    const existing = ownershipHistoryById.get(event.id);
    if (existing) existing.ownerIds.push(owner.id);
    else ownershipHistoryById.set(event.id, event);
  }
  const detailedGrave = {
    ...toGraveSummary(grave),
    uuid: grave.uuid,
    approvedExceptions: grave.approved_exceptions ?? undefined,
    stackingAuthorizedOn: includeOwnership ? grave.stacking_authorized_on ?? undefined : undefined,
    stackingAuthorizationReference: includeOwnership ? grave.stacking_authorization_reference ?? undefined : undefined,
    name: grave.name ?? "",
    version: grave.version,
    cost: grave.cost === null || grave.cost === undefined ? undefined : Number(grave.cost),
    owners: graveOwners.map(toOwner),
    currentOwnerIds: graveOwners.map((owner) => owner.id),
    burials: graveBurials.map(toBurial),
    headstones: graveHeadstones.map(toHeadstone),
    features: graveFeatures.map(toGraveFeature),
    maintenanceRecords: maintenanceRecords.map(toMaintenanceRecord),
    northHillsEvidence: northHillsEvidence.map(toNorthHillsEvidence),
    mediaAssets: mediaAssets.map(toMediaAsset),
    ownershipHistory: [...ownershipHistoryById.values()],
    notes: grave.cost ? `Recorded cost: $${grave.cost}` : undefined,
    lotAreaType: grave.lot_area_type ?? "lot",
    lotGeometryType: grave.lot_geometry_type ?? undefined,
    lotGeometrySource: grave.lot_geometry_source ?? undefined,
    lotGeometryConfidence: grave.lot_geometry_confidence ?? undefined,
    lotGeometryNotes: grave.lot_geometry_notes ?? undefined,
  };

  return includeOwnership ? detailedGrave : ownershipRedactedGrave(detailedGrave);
}
export async function loadDetailedGrave(client, cemeteryId, gravesiteId, includeOwnership = true, { parallel = false } = {}) {
  const grave = await selectGraveByCemeteryAndId(client, cemeteryId, gravesiteId);
  if (!grave) return undefined;

  const queries = [
    () => includeOwnership ? selectOwnersForGrave(client, grave.uuid) : Promise.resolve([]),
    () => selectBurialsForGrave(client, grave.uuid),
    () => selectHeadstonesForGrave(client, grave.uuid),
    () => selectNorthHillsEvidenceForGrave(client, grave.uuid),
    () => selectMediaAssetsForGrave(client, grave.uuid),
    () => selectFeaturesForGrave(client, grave.uuid),
    () => selectMaintenanceForGrave(client, grave.uuid),
  ];
  const rows = [];
  if (parallel) rows.push(...await runBoundedQueries(queries));
  else for (const query of queries) rows.push(await query());
  const [owners, burials, headstones, northHillsEvidence, mediaAssets, features, maintenanceRecords] = rows;

  return toDetailedGrave(grave, owners, burials, headstones, northHillsEvidence, mediaAssets, features, maintenanceRecords, includeOwnership);
}
