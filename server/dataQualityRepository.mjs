const severityOrder = new Map([
  ["high", 1],
  ["medium", 2],
  ["low", 3],
  ["info", 4],
]);

function toInteger(value) {
  return Number.parseInt(String(value ?? "0"), 10) || 0;
}

function cemeteryScopeValues(cemeteryIds) {
  if (!Array.isArray(cemeteryIds)) return null;
  return [...new Set(cemeteryIds.map((id) => String(id ?? "").trim()).filter(Boolean))];
}

function toMetric(row) {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    count: toInteger(row.count),
    severity: row.severity,
    category: row.category,
  };
}

export async function listDataQualityDashboard(pool, options = {}) {
  const cemeteryIds = cemeteryScopeValues(options.cemeteryIds);
  const result = await pool.query(
    `
      WITH scoped_cemeteries AS (
        SELECT cemeteries.id
        FROM cemeteries
        WHERE cemeteries.deleted_at IS NULL
          AND ($1::uuid[] IS NULL OR cemeteries.id = ANY($1::uuid[]))
      ),
      scoped_gravesites AS (
        SELECT gravesites.*
        FROM gravesites
        JOIN scoped_cemeteries ON scoped_cemeteries.id = gravesites.cemetery_id
        WHERE gravesites.deleted_at IS NULL
      ),
      scoped_lots AS (
        SELECT lots.*
        FROM lots
        JOIN scoped_cemeteries ON scoped_cemeteries.id = lots.cemetery_id
        WHERE lots.deleted_at IS NULL
      ),
      scoped_headstones AS (
        SELECT headstones.*
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
          ORDER BY gravesites.gravesite_id, gravesites.id
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
        JOIN scoped_cemeteries ON scoped_cemeteries.id = COALESCE(direct_gravesite.cemetery_id, linked_gravesite.cemetery_id, containing_cemetery.id)
        WHERE headstones.deleted_at IS NULL
      ),
      scoped_burials AS (
        SELECT burials.*
        FROM burials
        JOIN scoped_gravesites ON scoped_gravesites.id = burials.gravesite_uuid
        WHERE burials.deleted_at IS NULL
      ),
      scoped_nhg_entries AS (
        SELECT north_hills_ocr_entries.*
        FROM north_hills_ocr_entries
        JOIN scoped_cemeteries ON scoped_cemeteries.id = north_hills_ocr_entries.cemetery_id
      ),
      scoped_source_person_records AS (
        SELECT source_person_records.*
        FROM source_person_records
        JOIN scoped_cemeteries ON scoped_cemeteries.id = source_person_records.cemetery_id
      ),
      scoped_media_assets AS (
        SELECT media_assets.*
        FROM media_assets
        JOIN scoped_cemeteries ON scoped_cemeteries.id = media_assets.cemetery_id
        WHERE media_assets.deleted_at IS NULL
          AND media_assets.status = 'linked'
      )
      SELECT *
      FROM (
        SELECT
          'nhg_review_needed' AS id,
          'NHG readings needing review' AS label,
          'Staged North Hills readings that still have review or low parser confidence.' AS description,
          count(*)::int AS count,
          'high' AS severity,
          'Readings' AS category
        FROM scoped_nhg_entries
        WHERE status = 'staged'
          AND parse_confidence IN ('review', 'low')

        UNION ALL

        SELECT
          'nhg_unlinked' AS id,
          'NHG readings without confirmed links' AS label,
          'Active North Hills readings that do not yet have a linked gravesite or marker.' AS description,
          count(*)::int AS count,
          'medium' AS severity,
          'Readings' AS category
        FROM scoped_nhg_entries entry
        WHERE entry.status <> 'rejected'
          AND NOT EXISTS (
            SELECT 1
            FROM north_hills_ocr_entry_gravesite_links link
            WHERE link.entry_id = entry.id
              AND link.status = 'linked'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM north_hills_ocr_entry_headstone_links link
            WHERE link.entry_id = entry.id
              AND link.status = 'linked'
          )

        UNION ALL

        SELECT
          'source_person_records_unmatched' AS id,
          'Source person records needing matches' AS label,
          'Church, funeral, or source-only person records that are not yet linked to a burial, gravesite, or marker.' AS description,
          count(*)::int AS count,
          'medium' AS severity,
          'Readings' AS category
        FROM scoped_source_person_records record
        WHERE record.status IN ('unmatched', 'candidate_match')

        UNION ALL

        SELECT
          'gravesites_without_markers' AS id,
          'Gravesites without linked markers' AS label,
          'Active gravesites that do not have a current marker relationship.' AS description,
          count(*)::int AS count,
          'medium' AS severity,
          'Map links' AS category
        FROM scoped_gravesites gravesite
        WHERE NOT EXISTS (
          SELECT 1
          FROM headstone_gravesites link
          JOIN headstones headstone ON headstone.id = link.headstone_uuid
          WHERE link.gravesite_uuid = gravesite.id
            AND link.deleted_at IS NULL
            AND headstone.deleted_at IS NULL
        )

        UNION ALL

        SELECT
          'markers_without_gravesites' AS id,
          'Markers without linked gravesites' AS label,
          'Active markers that are not linked to a gravesite.' AS description,
          count(*)::int AS count,
          'medium' AS severity,
          'Map links' AS category
        FROM scoped_headstones headstone
        WHERE NOT EXISTS (
          SELECT 1
          FROM headstone_gravesites link
          JOIN gravesites gravesite ON gravesite.id = link.gravesite_uuid
          WHERE link.headstone_uuid = headstone.id
            AND link.deleted_at IS NULL
            AND gravesite.deleted_at IS NULL
        )

        UNION ALL

        SELECT
          'lots_without_gravesites' AS id,
          'Lots without gravesites' AS label,
          'Active lots that do not currently contain any active gravesites.' AS description,
          count(*)::int AS count,
          'info' AS severity,
          'Map links' AS category
        FROM scoped_lots lot
        WHERE NOT EXISTS (
          SELECT 1
          FROM scoped_gravesites gravesite
          WHERE gravesite.lot_uuid = lot.id
        )

        UNION ALL

        SELECT
          'partial_date_text' AS id,
          'Burials with partial date text' AS label,
          'Burials where recorded birth or death dates are stored as partial text rather than exact dates.' AS description,
          count(*)::int AS count,
          'info' AS severity,
          'Burials' AS category
        FROM scoped_burials burial
        WHERE (
            NULLIF(btrim(COALESCE(burial.birth_date_text, '')), '') IS NOT NULL
            AND burial.birth_date IS NULL
          )
          OR (
            NULLIF(btrim(COALESCE(burial.death_date_text, '')), '') IS NOT NULL
            AND burial.death_date IS NULL
          )

        UNION ALL

        SELECT
          'veterans_missing_service_details' AS id,
          'Veterans missing service details' AS label,
          'Veteran burials missing branch, rank, or war/service values.' AS description,
          count(*)::int AS count,
          'medium' AS severity,
          'Burials' AS category
        FROM scoped_burials burial
        WHERE lower(btrim(COALESCE(burial.veteran, ''))) IN ('yes', 'y', 'true', '1', 'veteran')
          AND (
            burial.military_branch_type_id IS NULL
            OR burial.military_rank_type_id IS NULL
            OR burial.military_war_service_type_id IS NULL
          )

        UNION ALL

        SELECT
          'photos_missing_date_taken' AS id,
          'Photos missing date taken' AS label,
          'Linked photo assets that do not have a captured date from EXIF or manual entry.' AS description,
          count(*)::int AS count,
          'low' AS severity,
          'Media' AS category
        FROM scoped_media_assets media_asset
        WHERE media_asset.asset_type = 'photo'
          AND media_asset.captured_at IS NULL

        UNION ALL

        SELECT
          'open_maintenance_records' AS id,
          'Open maintenance records' AS label,
          'Maintenance records that are still open or scheduled.' AS description,
          count(*)::int AS count,
          'low' AS severity,
          'Maintenance' AS category
        FROM maintenance_records maintenance_record
        JOIN scoped_cemeteries ON scoped_cemeteries.id = maintenance_record.cemetery_id
        WHERE maintenance_record.deleted_at IS NULL
          AND maintenance_record.status IN ('open', 'scheduled')
      ) metrics
      ORDER BY
        CASE severity
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END,
        label
    `,
    [cemeteryIds],
  );

  const metrics = result.rows.map(toMetric);
  return {
    generatedAt: new Date().toISOString(),
    scope: cemeteryIds === null ? "all" : "assigned",
    totalOpenItems: metrics
      .filter((metric) => metric.severity !== "info")
      .reduce((total, metric) => total + metric.count, 0),
    metrics: metrics.sort((left, right) => {
      const severityDelta = (severityOrder.get(left.severity) ?? 99) - (severityOrder.get(right.severity) ?? 99);
      return severityDelta || left.label.localeCompare(right.label);
    }),
  };
}
