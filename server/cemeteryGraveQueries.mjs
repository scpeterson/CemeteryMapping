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
export function toDetailedGrave(grave, graveOwners, graveBurials, graveHeadstones, northHillsEvidence, mediaAssets, graveFeatures, maintenanceRecords, includeOwnership) {
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
export async function loadDetailedGrave(client, cemeteryId, gravesiteId, includeOwnership = true) {
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
}
