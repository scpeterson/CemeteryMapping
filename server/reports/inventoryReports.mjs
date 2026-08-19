import { derivedGravesiteStatusSql } from "../gravesiteStatusSql.mjs";
import { optionalTextParameter, reportResult, scopedWhere } from "./shared.mjs";

export async function runSpatialInventoryCounts(client, definition, parameters, cemeteryIds) {
  const sectionName = optionalTextParameter(parameters, "sectionName", 80);
  const values = [];
  const scope = scopedWhere("cemeteries.id", values, cemeteryIds);
  const sectionFilters = [];
  if (sectionName) {
    values.push(sectionName);
    sectionFilters.push(`upper(section) = upper($${values.length})`);
  }
  const markerSectionWhere = sectionFilters.length ? `WHERE ${sectionFilters.join(" AND ")}` : "";
  const gravesiteSectionWhere = sectionFilters.length ? `WHERE ${sectionFilters.join(" AND ")}` : "";
  const finalSectionWhere = sectionFilters.length ? `WHERE ${sectionFilters.join(" AND ")}` : "";

  const result = await client.query(
    `
      WITH active_cemeteries AS (
        SELECT cemeteries.id, cemeteries.name, cemeteries.geometry
        FROM cemeteries
        WHERE cemeteries.deleted_at IS NULL
          ${scope}
      ),
      active_sections AS (
        SELECT sections.section_id, sections.cemetery_id, sections.name, sections.geometry
        FROM sections
        JOIN active_cemeteries
          ON active_cemeteries.id = sections.cemetery_id
        WHERE sections.deleted_at IS NULL
      ),
      marker_locations AS (
        SELECT DISTINCT
          headstones.id AS marker_uuid,
          active_cemeteries.name AS cemetery,
          COALESCE(NULLIF(linked_gravesites.section_id, ''), NULLIF(covering_sections.name, ''), 'Unsectioned') AS section
        FROM headstones
        LEFT JOIN gravesites linked_gravesites
          ON linked_gravesites.id = headstones.gravesite_uuid
         AND linked_gravesites.deleted_at IS NULL
        JOIN active_cemeteries
          ON active_cemeteries.id = linked_gravesites.cemetery_id
          OR (
            linked_gravesites.id IS NULL
            AND headstones.geometry IS NOT NULL
            AND ST_Covers(active_cemeteries.geometry, headstones.geometry)
          )
        LEFT JOIN LATERAL (
          SELECT active_sections.name
          FROM active_sections
          WHERE active_sections.cemetery_id = active_cemeteries.id
            AND headstones.geometry IS NOT NULL
            AND ST_Covers(active_sections.geometry, headstones.geometry)
          ORDER BY active_sections.name
          LIMIT 1
        ) covering_sections ON true
        WHERE headstones.deleted_at IS NULL
      ),
      filtered_marker_locations AS (
        SELECT cemetery, section, marker_uuid
        FROM marker_locations
        ${markerSectionWhere}
      ),
      marker_counts AS (
        SELECT cemetery, section, count(DISTINCT marker_uuid)::int AS marker_count
        FROM filtered_marker_locations
        GROUP BY cemetery, section
      ),
      gravesite_locations AS (
        SELECT
          active_cemeteries.name AS cemetery,
          COALESCE(NULLIF(gravesites.section_id, ''), 'Unsectioned') AS section,
          gravesites.id AS gravesite_uuid
        FROM gravesites
        JOIN active_cemeteries
          ON active_cemeteries.id = gravesites.cemetery_id
        WHERE gravesites.deleted_at IS NULL
      ),
      filtered_gravesite_locations AS (
        SELECT cemetery, section, gravesite_uuid
        FROM gravesite_locations
        ${gravesiteSectionWhere}
      ),
      gravesite_counts AS (
        SELECT cemetery, section, count(DISTINCT gravesite_uuid)::int AS gravesite_count
        FROM filtered_gravesite_locations
        GROUP BY cemetery, section
      ),
      combined_counts AS (
        SELECT
          COALESCE(marker_counts.cemetery, gravesite_counts.cemetery) AS cemetery,
          COALESCE(marker_counts.section, gravesite_counts.section) AS section,
          COALESCE(marker_counts.marker_count, 0)::int AS marker_count,
          COALESCE(gravesite_counts.gravesite_count, 0)::int AS gravesite_count
        FROM marker_counts
        FULL OUTER JOIN gravesite_counts
          ON marker_counts.cemetery = gravesite_counts.cemetery
         AND marker_counts.section = gravesite_counts.section
      )
      SELECT cemetery, section, marker_count, gravesite_count
      FROM combined_counts
      ${finalSectionWhere}
      ORDER BY cemetery, section
    `,
    values,
  );

  const markerTotal = result.rows.reduce((total, row) => total + Number(row.marker_count ?? 0), 0);
  const gravesiteTotal = result.rows.reduce((total, row) => total + Number(row.gravesite_count ?? 0), 0);
  const scopeText = sectionName ? ` in section ${sectionName}` : "";

  return reportResult({
    definition,
    summary: `${markerTotal} marker${markerTotal === 1 ? "" : "s"} and ${gravesiteTotal} gravesite${gravesiteTotal === 1 ? "" : "s"} counted${scopeText}.`,
    columns: [
      { key: "cemetery", label: "Cemetery" },
      { key: "section", label: "Section" },
      { key: "marker_count", label: "Markers" },
      { key: "gravesite_count", label: "Gravesites" },
    ],
    rows: result.rows,
    notes: ["Markers are counted from linked gravesites when available, otherwise from marker GPS position inside cemetery and section geometry."],
  });
}

export async function runMarkerTypeInventory(client, definition, parameters, cemeteryIds) {
  const sectionName = optionalTextParameter(parameters, "sectionName", 80);
  const markerType = optionalTextParameter(parameters, "markerType", 80);
  const values = [];
  const scope = scopedWhere("cemeteries.id", values, cemeteryIds);
  const filters = [];
  if (sectionName) {
    values.push(sectionName);
    filters.push(`upper(section) = upper($${values.length})`);
  }
  if (markerType) {
    values.push(`%${markerType}%`);
    filters.push(`(marker_type ILIKE $${values.length} OR marker_type_code ILIKE $${values.length})`);
  }
  const filteredWhere = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const result = await client.query(
    `
      WITH active_cemeteries AS (
        SELECT cemeteries.id, cemeteries.name, cemeteries.geometry
        FROM cemeteries
        WHERE cemeteries.deleted_at IS NULL
          ${scope}
      ),
      active_sections AS (
        SELECT sections.section_id, sections.cemetery_id, sections.name, sections.geometry
        FROM sections
        JOIN active_cemeteries
          ON active_cemeteries.id = sections.cemetery_id
        WHERE sections.deleted_at IS NULL
      ),
      marker_locations AS (
        SELECT DISTINCT
          headstones.id AS marker_uuid,
          headstones.headstone_id,
          active_cemeteries.name AS cemetery,
          COALESCE(NULLIF(linked_gravesites.section_id, ''), NULLIF(covering_sections.name, ''), 'Unsectioned') AS section,
          COALESCE(NULLIF(marker_types.label, ''), NULLIF(marker_types.code, ''), 'Unknown/not recorded') AS marker_type,
          COALESCE(NULLIF(marker_types.code, ''), 'unknown') AS marker_type_code
        FROM headstones
        LEFT JOIN gravesites linked_gravesites
          ON linked_gravesites.id = headstones.gravesite_uuid
         AND linked_gravesites.deleted_at IS NULL
        JOIN active_cemeteries
          ON active_cemeteries.id = linked_gravesites.cemetery_id
          OR (
            linked_gravesites.id IS NULL
            AND headstones.geometry IS NOT NULL
            AND ST_Covers(active_cemeteries.geometry, headstones.geometry)
          )
        LEFT JOIN LATERAL (
          SELECT active_sections.name
          FROM active_sections
          WHERE active_sections.cemetery_id = active_cemeteries.id
            AND headstones.geometry IS NOT NULL
            AND ST_Covers(active_sections.geometry, headstones.geometry)
          ORDER BY active_sections.name
          LIMIT 1
        ) covering_sections ON true
        LEFT JOIN marker_types
          ON marker_types.id = headstones.marker_type_id
        WHERE headstones.deleted_at IS NULL
      ),
      filtered_marker_locations AS (
        SELECT cemetery, section, marker_type, marker_type_code, headstone_id, marker_uuid
        FROM marker_locations
        ${filteredWhere}
      )
      SELECT
        cemetery,
        section,
        marker_type,
        count(DISTINCT marker_uuid)::int AS marker_count,
        string_agg(DISTINCT headstone_id, ', ' ORDER BY headstone_id) AS markers
      FROM filtered_marker_locations
      GROUP BY cemetery, section, marker_type
      ORDER BY cemetery, section, marker_type
    `,
    values,
  );

  const markerTotal = result.rows.reduce((total, row) => total + Number(row.marker_count ?? 0), 0);
  const qualifier = [sectionName ? `section ${sectionName}` : "", markerType ? `type matching "${markerType}"` : ""].filter(Boolean).join(", ");
  const suffix = qualifier ? ` for ${qualifier}` : "";

  return reportResult({
    definition,
    summary: `${markerTotal} marker${markerTotal === 1 ? "" : "s"} listed by type${suffix}.`,
    columns: [
      { key: "cemetery", label: "Cemetery" },
      { key: "section", label: "Section" },
      { key: "marker_type", label: "Marker type" },
      { key: "marker_count", label: "Markers" },
      { key: "markers", label: "Marker IDs" },
    ],
    rows: result.rows,
    notes: ["Markers are grouped by the marker type lookup value currently linked to each marker."],
  });
}

export async function runAvailableInventory(client, definition, cemeteryIds) {
  const values = [];
  const scope = scopedWhere("gravesites.cemetery_id", values, cemeteryIds);
  const derivedStatus = derivedGravesiteStatusSql();
  const result = await client.query(
    `
      WITH available_gravesites AS (
        SELECT
          cemeteries.name AS cemetery,
          gravesites.lot_uuid,
          lots.section_id AS lot_section,
          lots.lot_id,
          gravesites.section_id,
          gravesites.grave_id,
          gravesites.gravesite_id,
          gravesites.cost,
          ${derivedStatus} AS status
        FROM gravesites
        JOIN cemeteries
          ON cemeteries.id = gravesites.cemetery_id
        LEFT JOIN lots
          ON lots.id = gravesites.lot_uuid
        LEFT JOIN gravesite_status_types status_type
          ON status_type.id = gravesites.status_type_id
        WHERE gravesites.deleted_at IS NULL
          ${scope}
      ),
      available_lots AS (
        SELECT
          cemetery,
          lot_uuid,
          concat_ws('-', NULLIF(lot_section, ''), NULLIF(lot_id, '')) AS record_label,
          count(*)::int AS gravesite_count,
          sum(coalesce(cost, 0)) AS total_cost
        FROM available_gravesites
        WHERE lot_uuid IS NOT NULL
        GROUP BY cemetery, lot_uuid, lot_section, lot_id
        HAVING bool_and(status = 'available')
      )
      SELECT
        'lot' AS target_type,
        cemetery,
        record_label,
        gravesite_count,
        total_cost,
        NULL::text AS gravesite_id
      FROM available_lots
      UNION ALL
      SELECT
        'gravesite' AS target_type,
        cemetery,
        concat_ws('-', NULLIF(section_id, ''), NULLIF(grave_id, '')) AS record_label,
        1 AS gravesite_count,
        cost AS total_cost,
        gravesite_id
      FROM available_gravesites
      WHERE status = 'available'
      ORDER BY target_type, cemetery, record_label
    `,
    values,
  );

  const lots = result.rows.filter((row) => row.target_type === "lot").length;
  const gravesites = result.rows.filter((row) => row.target_type === "gravesite").length;

  return reportResult({
    definition,
    summary: `${lots} whole lot${lots === 1 ? "" : "s"} and ${gravesites} gravesite${gravesites === 1 ? "" : "s"} appear available.`,
    columns: [
      { key: "target_type", label: "Type" },
      { key: "record_label", label: "Record" },
      { key: "gravesite_count", label: "Gravesites" },
      { key: "total_cost", label: "Cost" },
      { key: "cemetery", label: "Cemetery" },
      { key: "gravesite_id", label: "Record ID" },
    ],
    rows: result.rows,
    notes: ["A whole lot is listed when every active gravesite in that lot appears available."],
  });
}
