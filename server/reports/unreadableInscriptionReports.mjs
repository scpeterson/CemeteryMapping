import { reportMonumentRecord } from "./monumentNavigation.mjs";
import { optionalTextParameter, selectedAdminCemeteryId, reportResult, scopedWhere } from "./shared.mjs";

import { compareInspectionReadings } from "./inscriptionLegibility.mjs";
export { unreadableInscriptionReasons } from "./inscriptionLegibility.mjs";
export async function runUnreadableMonumentInscriptions(client, definition, parameters, cemeteryIds) {
  const selected = selectedAdminCemeteryId(parameters);
  if (selected) cemeteryIds = cemeteryIds ? cemeteryIds.filter(id => id === selected) : [selected];
  const section = optionalTextParameter(parameters, "sectionName", 80);
  const plots = optionalTextParameter(parameters, "includePlotMarkers", 10);
  const show = optionalTextParameter(parameters, "legibility", 20);
  if (!["", "yes", "no"].includes(plots) || !["", "full", "partial", "history"].includes(show)) {
    const error = new Error("Select valid plot-marker and legibility filters.");
    error.code = "REPORT_PARAMETER_INVALID"; throw error;
  }
  const values = [];
  const scope = scopedWhere("cemeteries.id", values, cemeteryIds);
  const filters = [];
  if (section) { values.push(section); filters.push(`upper(loc.section) = upper($${values.length})`); }
  if (plots === "no") filters.push("COALESCE(marker_scope_types.code,'') <> 'plot_marker' AND COALESCE(marker_types.code,'') <> 'plot_marker'");
  const result = await client.query(`
    WITH active_cemeteries AS (
      SELECT id, name, geometry FROM cemeteries WHERE deleted_at IS NULL ${scope}
    ), linked_locations AS (
      SELECT h.id marker_uuid, g.id grave_uuid, g.cemetery_id, COALESCE(NULLIF(s.name,''),NULLIF(g.section_id,''),'Unsectioned') section,
        g.display_label grave_label
      FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid AND g.deleted_at IS NULL
      LEFT JOIN sections s ON s.section_id=g.section_uuid AND s.deleted_at IS NULL
      UNION
      SELECT hg.headstone_uuid, g.id, g.cemetery_id, COALESCE(NULLIF(s.name,''),NULLIF(g.section_id,''),'Unsectioned'), g.display_label
      FROM headstone_gravesites hg JOIN gravesites g ON g.id=hg.gravesite_uuid AND g.deleted_at IS NULL
      LEFT JOIN sections s ON s.section_id=g.section_uuid AND s.deleted_at IS NULL
      WHERE hg.deleted_at IS NULL
    ), locations AS (
      SELECT * FROM linked_locations
      UNION
      SELECT h.id, NULL::uuid, cem.id, COALESCE(s.name,'Unsectioned'), NULL
      FROM headstones h JOIN active_cemeteries cem ON ST_Covers(cem.geometry,h.geometry)
      LEFT JOIN LATERAL (
        SELECT name FROM sections WHERE cemetery_id=cem.id AND deleted_at IS NULL
          AND ST_Covers(geometry,h.geometry) ORDER BY name,section_id LIMIT 1
      ) s ON true
      WHERE h.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM linked_locations WHERE marker_uuid=h.id)
    )
    SELECT h.id marker_uuid, h.headstone_id monument, cem.id::text cemetery_id, cem.name cemetery, loc.section,
      ST_AsGeoJSON(h.geometry)::json geometry,
      (SELECT gravesite_id FROM gravesites WHERE id=min(loc.grave_uuid::text)::uuid) gravesite_id,
      string_agg(DISTINCT loc.grave_label, ', ' ORDER BY loc.grave_label) gravesites,
      marker_types.label marker_type, marker_scope_types.label marker_scope,
      visits.inspections,
      (SELECT string_agg(DISTINCT COALESCE(NULLIF(b.display_name,''),NULLIF(b.full_name,''),concat_ws(' ',b.first_name,b.last_name)), '; ')
       FROM headstone_burials hb JOIN burials b ON b.id=hb.burial_uuid AND b.deleted_at IS NULL
       WHERE hb.headstone_uuid=h.id AND hb.deleted_at IS NULL) names
    FROM headstones h JOIN locations loc ON loc.marker_uuid=h.id
    JOIN active_cemeteries cem ON cem.id=loc.cemetery_id
    JOIN LATERAL (
      SELECT jsonb_agg(i.reading ORDER BY i.inspection_year DESC, i.inspected_at DESC NULLS LAST, i.version DESC, i.id DESC) inspections
      FROM (
        SELECT i.id, i.inspection_year, i.inspected_at, COALESCE(i.updated_at,i.created_at) version,
          jsonb_build_object('id',i.id,'inspectionYear',i.inspection_year,'inspectedAt',i.inspected_at,
            'source',i.source,'sourceType',i.source_type,'inscription',i.inscription,'faces',i.faces) reading
        FROM monument_inspections i WHERE i.headstone_uuid=h.id AND i.deleted_at IS NULL
        ORDER BY i.inspection_year DESC, i.inspected_at DESC NULLS LAST, COALESCE(i.updated_at,i.created_at) DESC, i.id DESC LIMIT 2
      ) i
    ) visits ON visits.inspections IS NOT NULL
    LEFT JOIN marker_types ON marker_types.id=h.marker_type_id
    LEFT JOIN marker_scope_types ON marker_scope_types.id=h.marker_scope_type_id
    WHERE h.deleted_at IS NULL ${filters.length ? `AND ${filters.join(" AND ")}` : ""}
    GROUP BY h.id, cem.id, cem.name, loc.section, marker_types.label, marker_scope_types.label,
      visits.inspections
    ORDER BY cem.name, loc.section, h.headstone_id
  `, values);
  const describe = inspection => inspection ? `${inspection.inspectedAt || `${inspection.inspectionYear} (exact date unknown)`} · ${inspection.source || "Source not recorded"}` : "No previous inspection";
  const rows = result.rows.flatMap(row => {
    const [latest, previous] = row.inspections;
    return compareInspectionReadings(latest, previous).filter(pair => show === "history"
      ? pair.now.unreadable || pair.before.unreadable : pair.now.unreadable && (!show || pair.now.code === show)).map(pair => ({
        ...row, inspections: undefined, monumentRecord: reportMonumentRecord(row),
        gravesites: row.gravesites || "Standalone marker",
        affected_surfaces: pair.face ? `${pair.face.label}${pair.old && pair.old.label !== pair.face.label ? ` (previously ${pair.old.label})` : ""}` : `${pair.old.label} (absent from latest)`,
        previous_face: pair.old?.label || "No matching previous face/reading",
        latest_legibility: pair.face ? pair.now.label : "No matching latest face/reading",
        previous_legibility: pair.old ? pair.before.label : previous ? "No matching previous face/reading" : "No previous inspection",
        legibility_code: pair.now.code, previous_legibility_code: pair.before.code,
        change: pair.changeReason ? `${pair.change}: ${pair.changeReason}` : pair.change,
        latest_inspection: describe(latest), previous_inspection: describe(previous),
        inscription: pair.now.text, previous_inscription_text: pair.before.text,
        issue: pair.face ? pair.now.basis : "Previous face/reading absent from latest",
        inspection_date: latest.inspectedAt || String(latest.inspectionYear), inspection_source: latest.source,
        inspection_id: latest.id, previous_inspection_id: previous?.id,
      }));
  });
  const count = new Set(rows.map(row => row.marker_uuid)).size;
  return reportResult({ definition, summary: `${count} monument${count === 1 ? "" : "s"} · ${rows.length} face/reading rows for photography and legibility review.`,
    subtitle: `${section ? `Section ${section}` : "All sections"} · Plot markers ${plots === "no" ? "excluded" : "included"} · Latest versus previous inspection`,
    columns: [
      { key: "monument", label: "Monument ID" }, { key: "affected_surfaces", label: "Face / reading" },
      { key: "latest_legibility", label: "Latest legibility" }, { key: "previous_legibility", label: "Previous legibility" },
      { key: "change", label: "Observed change" }, { key: "latest_inspection", label: "Latest inspection / source" },
      { key: "previous_inspection", label: "Previous inspection / source" },
      { key: "cemetery", label: "Cemetery" }, { key: "section", label: "Section" },
      { key: "inscription", label: "Latest transcription" }, { key: "previous_inscription_text", label: "Previous transcription" },
      { key: "issue", label: "Assessment basis" },
      { key: "gravesites", label: "Gravesite(s)" }, { key: "names", label: "Associated names" },
    ], rows, notes: [
      "One row per face or independent unassigned reading per section; totals count distinct monuments. Combined face text is not counted twice. Historical transcription entries do not supply current or previous assessments.",
      "Fully illegible means a whole-face Illegible assessment or exact standalone [illegible]. Partially illegible means a partial-legibility assessment or unreadable text mixed with surviving letters/numbers. A fragment alone without an extent assessment is labeled extent unknown. Blank is not illegible.",
      "Text indications include the word illegible and [-] with optional whitespace. Explicit legible/partial assessments take precedence over mixed-text cues. Text-derived extent is an inference for review; a matching word can occur in legitimate text. Original transcriptions are preserved verbatim.",
      "Latest and previous are the two most recent non-deleted inspections by year, exact date when present, then updated time and ID (creation time if a legacy updated time is absent). A year-only date remains explicitly unknown.",
      "Faces match by stable ID, then a unique case-insensitive label. Missing/unmatched faces, blank/not-assessed observations and unknown extent are not evidence of worsening or improvement. Open the monument to review its inspection history; these are recorded assessment changes, not proof of physical deterioration.",
      "Show Current or previous illegibility to include recovered readings and previously unreadable faces absent from the latest inspection. The default lists currently unreadable readings; no inspection or empty unassessed text alone is not a match.",
      "Scroll the table horizontally for dates, sources and full transcriptions. Same category with changed text is labeled separately from an unchanged category/text pair.",
      "Use the report to plan photographs or field review; a new photograph may not recover an unreadable inscription.",
    ],
  });
}
