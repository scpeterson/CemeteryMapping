import { optionalTextParameter, reportResult, scopedWhere } from "./shared.mjs";

export async function runMarkerBurialPages(client, definition, parameters, cemeteryIds) {
  const markerId = optionalTextParameter(parameters, "markerId", 80);
  const personName = optionalTextParameter(parameters, "personName", 120);
  const sectionName = optionalTextParameter(parameters, "sectionName", 80);
  const values = [];
  const filters = [];
  const scope = scopedWhere("gravesites.cemetery_id", values, cemeteryIds);

  if (markerId) {
    values.push(`%${markerId}%`);
    filters.push(`lower(headstones.headstone_id) LIKE lower($${values.length})`);
  }
  if (personName) {
    values.push(`%${personName}%`);
    filters.push(`lower(COALESCE(NULLIF(burials.full_name, ''), btrim(COALESCE(burials.first_name, '') || ' ' || COALESCE(burials.last_name, '')))) LIKE lower($${values.length})`);
  }
  if (sectionName) {
    values.push(sectionName);
    filters.push(`upper(gravesites.section_id) = upper($${values.length})`);
  }

  const result = await client.query(
    `
      SELECT
        headstones.id::text AS marker_uuid,
        headstones.headstone_id AS marker_id,
        cemeteries.name AS cemetery,
        gravesites.section_id AS section,
        gravesites.gravesite_id,
        concat_ws('-', NULLIF(gravesites.section_id, ''), NULLIF(gravesites.grave_id, '')) AS grave,
        COALESCE(NULLIF(marker_types.label, ''), marker_types.code) AS marker_type,
        COALESCE(NULLIF(marker_scope_types.label, ''), marker_scope_types.code) AS marker_scope,
        COALESCE(NULLIF(marker_material_types.label, ''), marker_material_types.code) AS marker_material,
        COALESCE(NULLIF(headstone_condition_types.label, ''), headstone_condition_types.code) AS marker_condition,
        headstones.inscription,
        headstones.design_notes,
        headstones.back_description,
        headstones.condition_notes,
        COALESCE(marker_photo.file_url, NULLIF(headstones.photo_url, '')) AS photo_url,
        COALESCE(marker_features.features, '[]'::jsonb) AS marker_features,
        burials.id::text AS burial_uuid,
        COALESCE(NULLIF(burials.full_name, ''), concat_ws(' ', NULLIF(burials.first_name, ''), NULLIF(burials.maiden_name, ''), NULLIF(burials.last_name, ''))) AS person,
        burials.first_name,
        burials.last_name,
        burials.maiden_name,
        COALESCE(burials.birth_date_text, burials.birth_date::text) AS birth_date,
        COALESCE(burials.death_date_text, burials.death_date::text) AS death_date,
        burials.burial_date,
        burial_interment_types.label AS interment_type,
        burial_record_status_types.label AS record_status,
        burials.funeral_home,
        lower(btrim(coalesce(burials.veteran, ''))) IN ('yes', 'y', 'true', '1', 'veteran') AS veteran,
        military_branch_types.label AS military_branch,
        military_rank_types.label AS military_rank,
        military_war_service_types.label AS military_war_service,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('code', military_decoration_types.code, 'label', military_decoration_types.label) ORDER BY military_decoration_types.sort_order, military_decoration_types.label)
          FROM burial_military_decorations
          JOIN military_decoration_types ON military_decoration_types.id = burial_military_decorations.military_decoration_type_id
          WHERE burial_military_decorations.burial_uuid = burials.id
        ), '[]'::jsonb) AS military_decorations,
        burials.notes AS burial_notes,
        nhg_evidence.nhg_text
      FROM headstones
      JOIN headstone_burials
        ON headstone_burials.headstone_uuid = headstones.id
       AND headstone_burials.deleted_at IS NULL
      JOIN burials
        ON burials.id = headstone_burials.burial_uuid
       AND burials.deleted_at IS NULL
      JOIN gravesites
        ON gravesites.id = burials.gravesite_uuid
       AND gravesites.deleted_at IS NULL
      JOIN cemeteries
        ON cemeteries.id = gravesites.cemetery_id
       AND cemeteries.deleted_at IS NULL
      LEFT JOIN marker_types ON marker_types.id = headstones.marker_type_id
      LEFT JOIN marker_scope_types ON marker_scope_types.id = headstones.marker_scope_type_id
      LEFT JOIN marker_material_types ON marker_material_types.id = headstones.material_type_id
      LEFT JOIN headstone_condition_types ON headstone_condition_types.id = headstones.condition_type_id
      LEFT JOIN burial_interment_types ON burial_interment_types.id = burials.interment_type_id
      LEFT JOIN burial_record_status_types ON burial_record_status_types.id = burials.burial_record_status_type_id
      LEFT JOIN military_branch_types ON military_branch_types.id = burials.military_branch_type_id
      LEFT JOIN military_rank_types ON military_rank_types.id = burials.military_rank_type_id
      LEFT JOIN military_war_service_types ON military_war_service_types.id = burials.military_war_service_type_id
      LEFT JOIN LATERAL (
        SELECT media_assets.file_url
        FROM headstone_media_assets
        JOIN media_assets ON media_assets.id = headstone_media_assets.media_asset_id
        WHERE headstone_media_assets.headstone_uuid = headstones.id
          AND headstone_media_assets.deleted_at IS NULL
          AND headstone_media_assets.status = 'linked'
          AND media_assets.deleted_at IS NULL
          AND media_assets.status = 'linked'
          AND media_assets.asset_type = 'photo'
        ORDER BY headstone_media_assets.display_order, media_assets.captured_at DESC NULLS LAST, media_assets.uploaded_at DESC
        LIMIT 1
      ) marker_photo ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', grave_features.id::text,
            'type', grave_feature_types.label,
            'subtype', grave_feature_subtypes.label,
            'placement', grave_feature_placement_types.label,
            'material', grave_feature_material_types.label,
            'symbolText', grave_features.symbol_text,
            'notes', grave_features.notes,
            'status', grave_features.status
          )
          ORDER BY grave_feature_types.sort_order, grave_feature_subtypes.sort_order NULLS LAST, grave_features.created_at
        ) AS features
        FROM grave_features
        JOIN grave_feature_types ON grave_feature_types.id = grave_features.feature_type_id
        LEFT JOIN grave_feature_subtypes ON grave_feature_subtypes.id = grave_features.feature_subtype_id
        LEFT JOIN grave_feature_placement_types ON grave_feature_placement_types.id = grave_features.placement_type_id
        LEFT JOIN grave_feature_material_types ON grave_feature_material_types.id = grave_features.material_type_id
        WHERE grave_features.headstone_uuid = headstones.id
          AND grave_features.deleted_at IS NULL
      ) marker_features ON true
      LEFT JOIN LATERAL (
        SELECT string_agg(
          concat_ws(' ', CASE WHEN entries.source_page_number IS NOT NULL THEN 'Page ' || entries.source_page_number || ':' END, entries.raw_text),
          E'\n\n' ORDER BY entries.source_page_number NULLS LAST, entries.source_line_start, entries.id
        ) AS nhg_text
        FROM north_hills_ocr_entries entries
        WHERE EXISTS (
          SELECT 1
          FROM north_hills_ocr_entry_headstone_links links
          WHERE links.entry_id = entries.id
            AND links.headstone_uuid = headstones.id
            AND links.status = 'linked'
        ) OR EXISTS (
          SELECT 1
          FROM north_hills_ocr_entry_gravesite_links links
          WHERE links.entry_id = entries.id
            AND links.gravesite_uuid = gravesites.id
            AND links.status = 'linked'
        )
      ) nhg_evidence ON true
      WHERE headstones.deleted_at IS NULL
        ${scope}
        ${filters.length ? `AND ${filters.join(" AND ")}` : ""}
      ORDER BY cemeteries.name, gravesites.section_id, headstones.headstone_id, person, burials.id
    `,
    values,
  );

  const markerCount = new Set(result.rows.map((row) => row.marker_uuid)).size;

  return reportResult({
    definition,
    summary: `${markerCount} marker page${markerCount === 1 ? "" : "s"} generated for ${result.rows.length} burial${result.rows.length === 1 ? "" : "s"}.`,
    columns: [],
    rows: result.rows,
    layout: "marker-burial-pages",
    notes: ["Each marker is shown once with all of its linked burials grouped below it."],
  });
}

export async function runBurialDateExtremes(client, definition, cemeteryIds) {
  const values = [];
  const scope = scopedWhere("gravesites.cemetery_id", values, cemeteryIds);
  const result = await client.query(
    `
    WITH eligible_burials AS (
      SELECT
        cemeteries.name AS cemetery,
        concat_ws('-', NULLIF(gravesites.section_id, ''), NULLIF(gravesites.grave_id, '')) AS grave,
        gravesites.gravesite_id,
        COALESCE(NULLIF(burials.full_name, ''), concat_ws(' ', NULLIF(burials.first_name, ''), NULLIF(burials.last_name, ''))) AS person,
        burials.burial_date,
        COALESCE(burials.death_date_text, burials.death_date::text) AS death_date,
        burials.death_date AS death_date_sort
      FROM burials
      JOIN gravesites
        ON gravesites.id = burials.gravesite_uuid
      JOIN cemeteries
        ON cemeteries.id = gravesites.cemetery_id
      WHERE burials.deleted_at IS NULL
        AND gravesites.deleted_at IS NULL
        AND burials.burial_date IS NOT NULL
        ${scope}
    )
    (
      SELECT 'Oldest burial' AS result, cemetery, grave, gravesite_id, person, burial_date, death_date
      FROM eligible_burials
      ORDER BY burial_date ASC, death_date_sort ASC NULLS LAST, death_date ASC NULLS LAST, person
      LIMIT 1
    )
    UNION ALL
    (
      SELECT 'Latest burial' AS result, cemetery, grave, gravesite_id, person, burial_date, death_date
      FROM eligible_burials
      ORDER BY burial_date DESC, death_date_sort DESC NULLS LAST, death_date DESC NULLS LAST, person
      LIMIT 1
    )
  `,
    values,
  );

  return reportResult({
    definition,
    summary: result.rows.length ? "Earliest and most recent recorded burial dates." : "No burial dates are recorded.",
    columns: [
      { key: "result", label: "Result" },
      { key: "person", label: "Person" },
      { key: "burial_date", label: "Burial date" },
      { key: "death_date", label: "Death date" },
      { key: "grave", label: "Grave" },
      { key: "cemetery", label: "Cemetery" },
    ],
    rows: result.rows,
    notes: ["Only burials with a recorded burial date are included."],
  });
}

export async function runVeteranServiceSummary(client, definition, cemeteryIds) {
  const values = [];
  const scope = scopedWhere("gravesites.cemetery_id", values, cemeteryIds);
  const result = await client.query(
    `
    WITH veteran_burials AS (
      SELECT
        burials.id,
        COALESCE(military_branch_types.label, 'Unknown/not recorded') AS branch,
        COALESCE(military_war_service_types.label, 'Unknown/not recorded') AS war_service
      FROM burials
      JOIN gravesites
        ON gravesites.id = burials.gravesite_uuid
      LEFT JOIN military_branch_types
        ON military_branch_types.id = burials.military_branch_type_id
      LEFT JOIN military_war_service_types
        ON military_war_service_types.id = burials.military_war_service_type_id
      WHERE burials.deleted_at IS NULL
        AND gravesites.deleted_at IS NULL
        AND lower(btrim(coalesce(burials.veteran, ''))) IN ('yes', 'y', 'true', '1', 'veteran')
        ${scope}
    )
    SELECT 'Summary' AS group_name, 'Veteran burials' AS label, count(*)::int AS count
    FROM veteran_burials
    UNION ALL
    SELECT 'Military branch' AS group_name, branch AS label, count(*)::int AS count
    FROM veteran_burials
    GROUP BY branch
    UNION ALL
    SELECT 'War service' AS group_name, war_service AS label, count(*)::int AS count
    FROM veteran_burials
    GROUP BY war_service
    ORDER BY group_name, count DESC, label
  `,
    values,
  );
  const total = result.rows.find((row) => row.group_name === "Summary")?.count ?? 0;

  return reportResult({
    definition,
    summary: `${total} veteran burial${total === 1 ? "" : "s"} recorded.`,
    columns: [
      { key: "group_name", label: "Group" },
      { key: "label", label: "Value" },
      { key: "count", label: "Count" },
    ],
    rows: result.rows,
    notes: ["Branch and war service are grouped as Unknown/not recorded when no lookup value is set."],
  });
}
