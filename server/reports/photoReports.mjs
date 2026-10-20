import { optionalTextParameter, reportResult, scopedWhere } from "./shared.mjs";

export async function runMonumentPhotoExceptions(client, definition, parameters, cemeteryIds) {
  const sections = [...new Set(optionalTextParameter(parameters, "sectionNames", 500).split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const plotOption = optionalTextParameter(parameters, "includePlotMarkers", 20).toLowerCase();
  const issue = optionalTextParameter(parameters, "issue", 30);
  if (!["", "yes", "no"].includes(plotOption) || !["", "missing-photo", "missing-primary"].includes(issue)) {
    const error = new Error("Select a valid plot-marker option and photo issue.");
    error.code = "REPORT_PARAMETER_INVALID";
    throw error;
  }
  const values = [];
  const scope = scopedWhere("cemeteries.id", values, cemeteryIds);
  const filters = [];
  if (sections.length) {
    values.push(sections);
    filters.push(`upper(loc.section) = ANY($${values.length}::text[])`);
  }
  if (plotOption === "no") filters.push("COALESCE(marker_scope_types.code, '') <> 'plot_marker'");
  const result = await client.query(`
    WITH active_cemeteries AS (
      SELECT id, name, geometry FROM cemeteries WHERE deleted_at IS NULL ${scope}
    ), linked_locations AS (
      SELECT h.id marker_uuid, g.id grave_uuid, g.cemetery_id, COALESCE(s.name, g.section_id) section,
        g.display_label grave_label, g.lot_id
      FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid AND g.deleted_at IS NULL
      LEFT JOIN sections s ON s.section_id=g.section_uuid AND s.deleted_at IS NULL
      UNION
      SELECT hg.headstone_uuid, g.id, g.cemetery_id, COALESCE(s.name,g.section_id),
        g.display_label, g.lot_id
      FROM headstone_gravesites hg JOIN gravesites g ON g.id=hg.gravesite_uuid AND g.deleted_at IS NULL
      LEFT JOIN sections s ON s.section_id=g.section_uuid AND s.deleted_at IS NULL
      WHERE hg.deleted_at IS NULL
    ), locations AS (
      SELECT * FROM linked_locations
      UNION
      SELECT h.id, NULL::uuid, cem.id, COALESCE(s.name,'Unsectioned'), NULL, NULL
      FROM headstones h JOIN active_cemeteries cem ON ST_Covers(cem.geometry,h.geometry)
      LEFT JOIN LATERAL (
        SELECT name FROM sections WHERE cemetery_id=cem.id AND deleted_at IS NULL
          AND ST_Covers(geometry,h.geometry) ORDER BY name,section_id LIMIT 1
      ) s ON true
      WHERE h.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM linked_locations WHERE marker_uuid=h.id)
    )
    SELECT h.id marker_uuid, h.headstone_id monument, cem.name cemetery, loc.section,
      string_agg(DISTINCT loc.grave_label, ', ' ORDER BY loc.grave_label) gravesites,
      string_agg(DISTINCT loc.lot_id, ', ' ORDER BY loc.lot_id) lots,
      marker_types.label marker_type, marker_scope_types.label marker_scope, h.inscription,
      (SELECT string_agg(DISTINCT COALESCE(NULLIF(b.display_name,''),NULLIF(b.full_name,''),concat_ws(' ',b.first_name,b.last_name)), '; ')
       FROM headstone_burials hb JOIN burials b ON b.id=hb.burial_uuid AND b.deleted_at IS NULL
       WHERE hb.headstone_uuid=h.id AND hb.deleted_at IS NULL) names,
      photos.photo_count, photos.primary_count, NULLIF(btrim(h.photo_url),'') IS NOT NULL legacy_photo
    FROM headstones h JOIN locations loc ON loc.marker_uuid=h.id
    JOIN active_cemeteries cem ON cem.id=loc.cemetery_id
    LEFT JOIN marker_types ON marker_types.id=h.marker_type_id
    LEFT JOIN marker_scope_types ON marker_scope_types.id=h.marker_scope_type_id
    LEFT JOIN LATERAL (
      SELECT count(*)::int photo_count, count(*) FILTER(WHERE link.is_primary)::int primary_count
      FROM headstone_media_assets link JOIN media_assets asset ON asset.id=link.media_asset_id
      WHERE link.headstone_uuid=h.id AND link.deleted_at IS NULL AND link.status='linked'
        AND asset.deleted_at IS NULL AND asset.status='linked' AND asset.asset_type='photo'
        AND NULLIF(btrim(asset.file_url),'') IS NOT NULL
    ) photos ON true
    WHERE h.deleted_at IS NULL ${filters.length ? `AND ${filters.join(" AND ")}` : ""}
    GROUP BY h.id, cem.name, loc.section, marker_types.label, marker_scope_types.label, photos.photo_count, photos.primary_count
    ORDER BY cem.name, loc.section, h.headstone_id
  `, values);
  const exceptions = result.rows.filter((r) => r.primary_count === 0).map((r) => ({
    ...r, gravesites: r.gravesites || "Standalone marker",
    issue_code: r.photo_count === 0 && !r.legacy_photo ? "missing-photo" : "missing-primary",
    issue: r.photo_count === 0 && !r.legacy_photo ? "No monument photo" : "Photos present; no Primary",
    legacy_photo: r.legacy_photo ? "Yes" : "No",
  }));
  const rows = exceptions.filter((r) => !issue || r.issue_code === issue);
  const count = (items) => new Set(items.map((r) => r.marker_uuid)).size;
  return reportResult({
    definition,
    summary: `${count(result.rows)} monuments checked; ${count(rows)} match the selected photo issues.`,
    subtitle: `${sections.length ? `Sections ${sections.join(", ")}` : "All sections"} · Plot markers ${plotOption === "no" ? "excluded" : "included"}`,
    columns: [
      { key: "cemetery", label: "Cemetery" }, { key: "section", label: "Section" },
      { key: "gravesites", label: "Gravesite(s)" }, { key: "monument", label: "Monument ID" },
      { key: "marker_type", label: "Marker type" }, { key: "marker_scope", label: "Marker scope" },
      { key: "inscription", label: "Inscription" }, { key: "lots", label: "Lot(s)" },
      { key: "names", label: "Associated names" }, { key: "photo_count", label: "Monument photos" },
      { key: "legacy_photo", label: "Legacy photo" }, { key: "issue", label: "Photo issue" },
    ], rows,
    notes: [
      `${count(exceptions.filter((r) => r.issue_code === "missing-photo"))} monuments have no photo; ${count(exceptions.filter((r) => r.issue_code === "missing-primary"))} have photos but no Primary.`,
      "Only active linked monument photos count. Gravesite photos, documents, deleted media, and unlinked or review-only media do not count.",
      "Legacy monument photo URLs count as photos but cannot supply a Primary flag.",
      "Standalone markers use their map location. A marker spanning sections is listed once per section; totals count distinct monuments.",
    ],
  });
}
