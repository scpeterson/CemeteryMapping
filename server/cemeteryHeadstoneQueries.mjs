import { selectFeaturesForHeadstones } from "./cemeteryFeatureQueries.mjs";
import { selectMaintenanceForHeadstones } from "./cemeteryMaintenanceQueries.mjs";
import { selectRelationshipsForHeadstone } from "./cemeteryRelationshipQueries.mjs";
import { recordReviewColumnsSql, tableColumnExists } from "./cemeterySchema.mjs";

const headstoneDetailColumnsSql = `
  headstones.id::text,
  headstones.headstone_id,
  marker_types.id::text AS marker_type_id,
  marker_types.code AS marker_type_code,
  marker_types.label AS marker_type_label,
  marker_material_types.id::text AS material_id,
  marker_material_types.code AS material_code,
  marker_material_types.label AS material_label,
  headstone_condition_types.id::text AS condition_id,
  headstone_condition_types.code AS condition_code,
  headstone_condition_types.label AS condition_label,
  headstone_vase_types.id::text AS vase_type_id,
  headstone_vase_types.code AS vase_type_code,
  headstone_vase_types.label AS vase_type_label,
  headstone_vase_material_types.id::text AS vase_material_id,
  headstone_vase_material_types.code AS vase_material_code,
  headstone_vase_material_types.label AS vase_material_label,
  headstone_vase_placement_types.id::text AS vase_placement_id,
  headstone_vase_placement_types.code AS vase_placement_code,
  headstone_vase_placement_types.label AS vase_placement_label,
  headstones.vase_notes,
  headstones.condition_notes,
  headstones.inscription,
  headstones.design_notes,
  headstones.back_description,
  headstones.photo_url,
  headstones.last_inspected_at,
  headstones.source_properties
`;

const headstoneLookupJoinsSql = `
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
`;

const headstoneEvidenceJoinSql = `
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', headstone_link.id::text,
        'entryId', entry.id::text,
        'targetType', 'headstone',
        'status', headstone_link.status,
        'confidence', headstone_link.confidence,
        'sourcePageNumber', entry.source_page_number,
        'nameText', entry.name_text,
        'parsedSectionName', entry.parsed_section_name,
        'parsedRowNumber', entry.parsed_row_number,
        'parsedPositionNumber', entry.parsed_position_number,
        'rawText', entry.raw_text,
        'reviewNotes', headstone_link.notes,
        'reviewedByEmail', headstone_link.reviewed_by_email,
        'reviewedAt', headstone_link.reviewed_at
      )
      ORDER BY entry.source_page_number NULLS LAST, entry.source_line_start, entry.id
    ) AS evidence
    FROM north_hills_ocr_entry_headstone_links headstone_link
    JOIN north_hills_ocr_entries entry
      ON entry.id = headstone_link.entry_id
    WHERE headstone_link.headstone_uuid = headstones.id
      AND headstone_link.status = 'linked'
  ) headstone_evidence ON true
`;

const headstoneMediaJoinSql = `
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', media_assets.id::text,
        'cemeteryId', media_assets.cemetery_id::text,
        'assetType', media_assets.asset_type,
        'fileUrl', media_assets.file_url,
        'thumbnailUrl', COALESCE(media_assets.thumbnail_url, ''),
        'originalFilename', COALESCE(media_assets.original_filename, ''),
        'contentType', COALESCE(media_assets.content_type, ''),
        'byteSize', COALESCE(media_assets.byte_size, 0),
        'capturedAt', media_assets.captured_at,
        'uploadedAt', media_assets.uploaded_at,
        'capturedByEmail', COALESCE(media_assets.captured_by_email, ''),
        'latitude', media_assets.latitude,
        'longitude', media_assets.longitude,
        'gpsAccuracy', media_assets.gps_accuracy,
        'deviceMake', COALESCE(media_assets.device_make, ''),
        'deviceModel', COALESCE(media_assets.device_model, ''),
        'notes', COALESCE(media_assets.notes, ''),
        'source', media_assets.source,
        'status', media_assets.status,
        'mediaLinkId', headstone_media_assets.id::text,
        'mediaLinkType', 'headstone',
        'displayOrder', headstone_media_assets.display_order
      )
      ORDER BY headstone_media_assets.display_order, media_assets.captured_at DESC NULLS LAST, media_assets.uploaded_at DESC, media_assets.id
    ) AS media_assets
    FROM headstone_media_assets
    JOIN media_assets
      ON media_assets.id = headstone_media_assets.media_asset_id
    WHERE headstone_media_assets.headstone_uuid = headstones.id
      AND headstone_media_assets.deleted_at IS NULL
      AND headstone_media_assets.status = 'linked'
      AND media_assets.deleted_at IS NULL
      AND media_assets.status = 'linked'
  ) headstone_media ON true
`;

const headstoneDetailGroupBySql = `
  headstones.id,
  headstones.headstone_id,
  marker_types.id,
  marker_types.code,
  marker_types.label,
  marker_material_types.id,
  marker_material_types.code,
  marker_material_types.label,
  headstone_condition_types.id,
  headstone_condition_types.code,
  headstone_condition_types.label,
  headstone_vase_types.id,
  headstone_vase_types.code,
  headstone_vase_types.label,
  headstone_vase_material_types.id,
  headstone_vase_material_types.code,
  headstone_vase_material_types.label,
  headstone_vase_placement_types.id,
  headstone_vase_placement_types.code,
  headstone_vase_placement_types.label,
  headstones.vase_notes,
  headstones.condition_notes,
  headstones.inscription,
  headstones.design_notes,
  headstones.back_description,
  headstones.photo_url,
  headstones.last_inspected_at,
  headstones.source_properties
`;

async function headstoneDetailReviewSql(client) {
  const selectSql = await recordReviewColumnsSql(client, "headstones");
  const hasReviewColumns = await tableColumnExists(client, "headstones", "data_confidence");
  return {
    select: selectSql,
    groupBy: hasReviewColumns
      ? `
          headstones.data_confidence,
          headstones.review_status,
          headstones.review_notes,
          headstones.source_conflict,
          headstones.reviewed_by,
          headstones.reviewed_at
        `
      : "",
  };
}

export async function selectHeadstonesForGrave(client, graveUuid) {
  const reviewSql = await headstoneDetailReviewSql(client);
  const result = await client.query(
    `
      WITH selected_headstones AS (
        SELECT DISTINCT ON (headstones.id, COALESCE(headstone_gravesites.relationship_type, 'primary'), headstone_gravesites.notes)
          headstones.*,
          COALESCE(headstone_gravesites.relationship_type, 'primary') AS selected_relationship_type,
          headstone_gravesites.notes AS selected_relationship_notes
        FROM headstones
        LEFT JOIN headstone_gravesites
          ON headstone_gravesites.headstone_uuid = headstones.id
         AND headstone_gravesites.deleted_at IS NULL
        WHERE headstones.deleted_at IS NULL
          AND (
            headstones.gravesite_uuid = $1
            OR headstone_gravesites.gravesite_uuid = $1
          )
        ORDER BY headstones.id, COALESCE(headstone_gravesites.relationship_type, 'primary'), headstone_gravesites.notes
      )
      SELECT
        ${headstoneDetailColumnsSql},
        ${reviewSql.select},
        headstones.selected_relationship_type AS relationship_type,
        headstones.selected_relationship_notes AS relationship_notes,
        array_remove(array_agg(DISTINCT headstone_burials.burial_uuid::text), NULL) AS burial_ids,
        COALESCE(headstone_evidence.evidence, '[]'::jsonb) AS north_hills_evidence,
        COALESCE(headstone_media.media_assets, '[]'::jsonb) AS media_assets
      FROM selected_headstones AS headstones
      LEFT JOIN headstone_burials
        ON headstone_burials.headstone_uuid = headstones.id
       AND headstone_burials.deleted_at IS NULL
      ${headstoneLookupJoinsSql}
      ${headstoneEvidenceJoinSql}
      ${headstoneMediaJoinSql}
      GROUP BY
        ${headstoneDetailGroupBySql},
        ${reviewSql.groupBy ? `${reviewSql.groupBy},` : ""}
        headstones.selected_relationship_type,
        headstones.selected_relationship_notes,
        headstone_evidence.evidence,
        headstone_media.media_assets
      ORDER BY headstones.headstone_id, headstones.id
    `,
    [graveUuid],
  );

  return result.rows;
}

export async function selectHeadstoneById(client, id) {
  const reviewSql = await headstoneDetailReviewSql(client);
  const result = await client.query(
    `
      WITH selected_headstones AS (
        SELECT headstones.*
        FROM headstones
        WHERE headstones.id = $1
          AND headstones.deleted_at IS NULL
      )
      SELECT
        ${headstoneDetailColumnsSql},
        ${reviewSql.select},
        COALESCE(headstone_relationship.relationship_type, 'primary') AS relationship_type,
        headstone_relationship.notes AS relationship_notes,
        COALESCE(associated_gravesites.gravesite_ids, ARRAY[]::text[]) AS associated_gravesite_ids,
        array_remove(array_agg(DISTINCT headstone_burials.burial_uuid::text), NULL) AS burial_ids,
        COALESCE(headstone_evidence.evidence, '[]'::jsonb) AS north_hills_evidence,
        COALESCE(headstone_media.media_assets, '[]'::jsonb) AS media_assets
      FROM selected_headstones AS headstones
      LEFT JOIN headstone_burials
        ON headstone_burials.headstone_uuid = headstones.id
       AND headstone_burials.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT relationship_type, notes
        FROM headstone_gravesites
        WHERE headstone_gravesites.headstone_uuid = headstones.id
          AND headstone_gravesites.deleted_at IS NULL
        ORDER BY
          CASE relationship_type
            WHEN 'spans' THEN 1
            WHEN 'nearby' THEN 2
            WHEN 'inferred' THEN 3
            ELSE 4
          END,
          created_at,
          id
        LIMIT 1
      ) headstone_relationship ON true
      LEFT JOIN LATERAL (
        SELECT array_remove(array_agg(DISTINCT associated_gravesite_rows.gravesite_id), NULL) AS gravesite_ids
        FROM (
          SELECT primary_gravesites.gravesite_id
          FROM gravesites primary_gravesites
          WHERE primary_gravesites.id = headstones.gravesite_uuid
            AND primary_gravesites.deleted_at IS NULL

          UNION

          SELECT linked_gravesites.gravesite_id
          FROM headstone_gravesites
          JOIN gravesites linked_gravesites
            ON linked_gravesites.id = headstone_gravesites.gravesite_uuid
           AND linked_gravesites.deleted_at IS NULL
          WHERE headstone_gravesites.headstone_uuid = headstones.id
            AND headstone_gravesites.deleted_at IS NULL
        ) associated_gravesite_rows
      ) associated_gravesites ON true
      ${headstoneLookupJoinsSql}
      ${headstoneEvidenceJoinSql}
      ${headstoneMediaJoinSql}
      GROUP BY
        ${headstoneDetailGroupBySql},
        ${reviewSql.groupBy ? `${reviewSql.groupBy},` : ""}
        headstone_relationship.relationship_type,
        headstone_relationship.notes,
        associated_gravesites.gravesite_ids,
        headstone_evidence.evidence,
        headstone_media.media_assets
      LIMIT 1
    `,
    [id],
  );

  const headstone = result.rows[0];
  if (!headstone) return undefined;

  const featuresByHeadstone = await selectFeaturesForHeadstones(client, [headstone.id]);
  const maintenanceByHeadstone = await selectMaintenanceForHeadstones(client, [headstone.id]);
  const relationships = await selectRelationshipsForHeadstone(client, headstone.id);
  return {
    ...headstone,
    features: featuresByHeadstone.get(headstone.id) ?? [],
    maintenance_records: maintenanceByHeadstone.get(headstone.id) ?? [],
    relationships,
  };
}
