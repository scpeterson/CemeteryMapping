import { inscriptionMissing } from "../../shared/inscriptionStatus.mjs";
import { reportResult, scopedWhere } from "./shared.mjs";

export async function runMissingMonumentInscriptions(client, definition, _parameters, cemeteryIds) {
  const values = [];
  const scope = scopedWhere("cemeteries.id", values, cemeteryIds);
  const result = await client.query(`
    WITH active_cemeteries AS (
      SELECT id, name, geometry FROM cemeteries WHERE deleted_at IS NULL ${scope}
    ), linked_locations AS (
      SELECT h.id marker_uuid, g.id grave_uuid, g.cemetery_id, COALESCE(s.name, g.section_id) section,
        concat_ws('-', COALESCE(s.name, g.section_id), NULLIF(g.grave_id, '')) grave_label, g.lot_id
      FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid AND g.deleted_at IS NULL
      LEFT JOIN sections s ON s.section_id=g.section_uuid AND s.deleted_at IS NULL
      UNION
      SELECT hg.headstone_uuid, g.id, g.cemetery_id, COALESCE(s.name,g.section_id),
        concat_ws('-', COALESCE(s.name,g.section_id), NULLIF(g.grave_id,'')), g.lot_id
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
      marker_types.label marker_type, marker_scope_types.label marker_scope, h.inscription, h.inscription_status, h.faces,
      (SELECT string_agg(DISTINCT COALESCE(NULLIF(b.display_name,''),NULLIF(b.full_name,''),concat_ws(' ',b.first_name,b.last_name)), '; ')
       FROM headstone_burials hb JOIN burials b ON b.id=hb.burial_uuid AND b.deleted_at IS NULL
       WHERE hb.headstone_uuid=h.id AND hb.deleted_at IS NULL) names
    FROM headstones h JOIN locations loc ON loc.marker_uuid=h.id
    JOIN active_cemeteries cem ON cem.id=loc.cemetery_id
    LEFT JOIN marker_types ON marker_types.id=h.marker_type_id
    LEFT JOIN marker_scope_types ON marker_scope_types.id=h.marker_scope_type_id
    WHERE h.deleted_at IS NULL AND upper(loc.section) IN ('A','B','C','D')
    GROUP BY h.id, cem.name, loc.section, marker_types.label, marker_scope_types.label
    ORDER BY cem.name, loc.section, h.headstone_id
  `, values);
  const rows = result.rows.flatMap((row) => {
    const faces = Array.isArray(row.faces) ? row.faces : [];
    const missingFaces = faces.map((face, index) => ({ face, index }))
      .filter(({ face }) => inscriptionMissing(face.inscriptionStatus, face.inscription));
    if (faces.length ? !missingFaces.length : !inscriptionMissing(row.inscription_status, row.inscription)) return [];
    return [{
      ...row, gravesites: row.gravesites || "Standalone marker", face_count: faces.length,
      missing_faces: missingFaces.map(({ face, index }) => `${face.label || "Unnamed face"} (face ${index + 1})`).join("; "),
      issue: faces.length ? "Face inscription missing" : "Monument inscription missing (no faces)",
    }];
  });
  const count = (items) => new Set(items.map((row) => row.marker_uuid)).size;
  return reportResult({
    definition, summary: `${count(result.rows)} monuments checked; ${count(rows)} have missing inscription data.`,
    subtitle: "Sections A–D · Plot markers included",
    columns: [
      { key: "cemetery", label: "Cemetery" }, { key: "section", label: "Section" },
      { key: "monument", label: "Monument ID" }, { key: "gravesites", label: "Gravesite(s)" },
      { key: "marker_type", label: "Marker type" }, { key: "marker_scope", label: "Marker scope" },
      { key: "names", label: "Associated names" }, { key: "face_count", label: "Face count" },
      { key: "missing_faces", label: "Faces needing inscription data" },
      { key: "inscription", label: "Existing monument inscription" }, { key: "issue", label: "Issue" },
    ], rows,
    notes: [
      "Faces are checked individually. Monuments without faces use their monument inscription status.",
      "Blank and Illegible statuses are valid without text. Not recorded, or Transcribed with empty text, needs data. Partial transcriptions including [blank] and [illegible] remain valid.",
      "Includes plot markers and standalone markers. Standalone markers use their map location. Deleted records are excluded.",
      "A monument spanning sections is listed once per section; totals count distinct monuments.",
    ],
  });
}
