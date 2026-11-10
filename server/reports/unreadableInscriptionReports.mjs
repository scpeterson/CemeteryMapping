import { reportMonumentRecord } from "./monumentNavigation.mjs";
import { reportResult, scopedWhere } from "./shared.mjs";

export function unreadableInscriptionReasons(text) {
  const value = String(text ?? "");
  return [
    /\billegible\b/iu.test(value) ? "Illegible text" : null,
    /\[\s*-\s*\]/u.test(value) ? "Unreadable [-] fragment" : null,
  ].filter(Boolean);
}

export async function runUnreadableMonumentInscriptions(client, definition, _parameters, cemeteryIds) {
  const values = [];
  const scope = scopedWhere("cemeteries.id", values, cemeteryIds);
  const result = await client.query(`
    WITH active_cemeteries AS (
      SELECT id, name, geometry FROM cemeteries WHERE deleted_at IS NULL ${scope}
    ), linked_locations AS (
      SELECT h.id marker_uuid, g.id grave_uuid, g.cemetery_id, COALESCE(s.name,g.section_id) section,
        g.display_label grave_label
      FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid AND g.deleted_at IS NULL
      LEFT JOIN sections s ON s.section_id=g.section_uuid AND s.deleted_at IS NULL
      UNION
      SELECT hg.headstone_uuid, g.id, g.cemetery_id, COALESCE(s.name,g.section_id), g.display_label
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
      latest.id::text inspection_id, latest.inspection_year, latest.inspected_at::text inspected_at,
      latest.source inspection_source, latest.inscription, latest.faces,
      (SELECT string_agg(DISTINCT COALESCE(NULLIF(b.display_name,''),NULLIF(b.full_name,''),concat_ws(' ',b.first_name,b.last_name)), '; ')
       FROM headstone_burials hb JOIN burials b ON b.id=hb.burial_uuid AND b.deleted_at IS NULL
       WHERE hb.headstone_uuid=h.id AND hb.deleted_at IS NULL) names
    FROM headstones h JOIN locations loc ON loc.marker_uuid=h.id
    JOIN active_cemeteries cem ON cem.id=loc.cemetery_id
    JOIN LATERAL (
      SELECT i.* FROM monument_inspections i WHERE i.headstone_uuid=h.id AND i.deleted_at IS NULL
      ORDER BY i.inspection_year DESC, i.inspected_at DESC NULLS LAST, i.created_at DESC, i.id DESC LIMIT 1
    ) latest ON true
    LEFT JOIN marker_types ON marker_types.id=h.marker_type_id
    LEFT JOIN marker_scope_types ON marker_scope_types.id=h.marker_scope_type_id
    WHERE h.deleted_at IS NULL
    GROUP BY h.id, cem.id, cem.name, loc.section, marker_types.label, marker_scope_types.label,
      latest.id, latest.inspection_year, latest.inspected_at, latest.source, latest.inscription, latest.faces
    ORDER BY cem.name, loc.section, h.headstone_id
  `, values);
  const rows = result.rows.flatMap((row) => {
    const texts = [{ label: "Monument", text: row.inscription ?? "" },
      ...(Array.isArray(row.faces) ? row.faces : []).map((face, index) => ({ label: face.label || `Face ${index + 1}`, text: face.inscription ?? "" }))];
    const matches = texts.map((item) => ({ ...item, reasons: unreadableInscriptionReasons(item.text) })).filter((item) => item.reasons.length);
    if (!matches.length) return [];
    return [{ ...row, monumentRecord: reportMonumentRecord(row), gravesites: row.gravesites || "Standalone marker",
      inspection_date: row.inspected_at || String(row.inspection_year),
      inscription: texts.filter((item) => String(item.text).trim()).map((item) => `${item.label}: ${item.text}`).join("\n"),
      affected_surfaces: matches.map((item) => item.label).join("; "),
      issue: [...new Set(matches.flatMap((item) => item.reasons))].join("; "),
    }];
  });
  const count = new Set(rows.map((row) => row.marker_uuid)).size;
  return reportResult({ definition, summary: `${count} monument${count === 1 ? " has" : "s have"} unreadable text in their latest inspection.`,
    subtitle: "All sections · Latest inspection only · Plot and standalone markers included",
    columns: [
      { key: "cemetery", label: "Cemetery" }, { key: "section", label: "Section" },
      { key: "monument", label: "Monument ID" }, { key: "gravesites", label: "Gravesite(s)" },
      { key: "names", label: "Associated names" }, { key: "inspection_date", label: "Inspection date/year" },
      { key: "inspection_source", label: "Inspection source" }, { key: "inscription", label: "Latest inspection inscription" },
      { key: "affected_surfaces", label: "Affected surfaces" }, { key: "issue", label: "Reason for follow-up" },
    ], rows, notes: [
      'Matches the word "illegible" regardless of case, including [illegible] and [illegible lines], or [-] with optional whitespace inside the brackets. Partial transcriptions are included.',
      "Checks the latest non-deleted inspection's monument and face inscriptions. Latest means inspection year, full date when present, then creation time, with a stable ID tie-breaker. Older inspections and historical face transcriptions do not cause a match.",
      "Includes all sections, plot markers and standalone markers within your permitted cemeteries. Deleted monuments and monuments without an inspection are excluded. Blank text alone does not match.",
      "Use this list to plan better photographs or field review; a match does not guarantee a new photograph can recover the inscription.",
      "A monument spanning sections is listed once per section; totals count distinct monuments.",
    ],
  });
}
