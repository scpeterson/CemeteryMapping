import { reportMonumentRecord } from "./monumentNavigation.mjs";
import { reportResult, scopedWhere } from "./shared.mjs";

export async function runMissingNhgLinks(client, definition, _parameters, cemeteryIds) {
  const values = [];
  const scope = scopedWhere("id", values, cemeteryIds);
  const result = await client.query(`
    WITH cem AS (
      SELECT id, name, geometry FROM cemeteries WHERE deleted_at IS NULL ${scope}
    ), g AS (
      SELECT g.*, COALESCE(s.name, g.section_id, 'Unsectioned') section
      FROM gravesites g JOIN cem ON cem.id = g.cemetery_id
      LEFT JOIN sections s ON s.section_id = g.section_uuid AND s.deleted_at IS NULL
      WHERE g.deleted_at IS NULL
    ), all_relations AS (
      SELECT h.id hid, g.id gid
      FROM headstones h JOIN gravesites g ON g.id = h.gravesite_uuid AND g.deleted_at IS NULL
      WHERE h.deleted_at IS NULL
      UNION
      SELECT hg.headstone_uuid, g.id
      FROM headstone_gravesites hg JOIN gravesites g ON g.id = hg.gravesite_uuid AND g.deleted_at IS NULL
      JOIN headstones h ON h.id = hg.headstone_uuid AND h.deleted_at IS NULL
      WHERE hg.deleted_at IS NULL
    ), relations AS (
      SELECT r.* FROM all_relations r JOIN g ON g.id = r.gid
    ), location_labels AS MATERIALIZED (
      SELECT r.hid, min(g.cemetery_id::text) AS cemetery_id, min(cem.name) AS cemetery,
        min(g.gravesite_id) AS gravesite_id,
        string_agg(DISTINCT g.section, ', ' ORDER BY g.section) AS section,
        string_agg(DISTINCT g.display_label, ', ' ORDER BY g.display_label) AS gravesites
      FROM relations r JOIN g ON g.id=r.gid JOIN cem ON cem.id=g.cemetery_id
      GROUP BY r.hid
    ), hlinks AS (
      SELECT DISTINCT l.headstone_uuid id
      FROM north_hills_ocr_entry_headstone_links l
      JOIN north_hills_ocr_entries e ON e.id = l.entry_id WHERE l.status = 'linked'
    ), h AS (
      SELECT h.*, COALESCE(
        labels.section,
        (SELECT s.name FROM sections s JOIN cem ON cem.id = s.cemetery_id
         WHERE s.deleted_at IS NULL AND ST_Covers(s.geometry, h.geometry)
         ORDER BY s.name LIMIT 1), 'Unsectioned'
      ) section
      FROM headstones h LEFT JOIN location_labels labels ON labels.hid=h.id
      WHERE h.deleted_at IS NULL AND (
        labels.hid IS NOT NULL
        OR (
          NOT EXISTS(SELECT 1 FROM all_relations r WHERE r.hid = h.id)
          AND EXISTS(SELECT 1 FROM cem WHERE ST_Covers(cem.geometry, h.geometry))
        )
      )
    )
    SELECT h.id::text uuid,
      COALESCE(
        labels.cemetery_id,
        (SELECT id::text FROM cem WHERE ST_Covers(cem.geometry, h.geometry) ORDER BY name LIMIT 1)
      ) cemetery_id,
      labels.gravesite_id gravesite_id,
      ST_AsGeoJSON(h.geometry)::json geometry,
      COALESCE(
        labels.cemetery,
        (SELECT name FROM cem WHERE ST_Covers(cem.geometry, h.geometry) ORDER BY name LIMIT 1)
      ) cemetery, h.headstone_id monument, h.section,
      labels.gravesites gravesites,
      EXISTS(SELECT 1 FROM hlinks WHERE id = h.id) direct_link,
      COALESCE(h.source_properties #>> '{NormalizedProvenance,nhgInclusion}', 'not_checked') nhg_inclusion,
      (SELECT label FROM marker_types WHERE id = h.marker_type_id) marker_type,
      (SELECT label FROM marker_scope_types WHERE id = h.marker_scope_type_id) marker_scope
    FROM h LEFT JOIN location_labels labels ON labels.hid=h.id ORDER BY cemetery, section, monument
  `, values);
  const eligible = result.rows.filter((row) => row.nhg_inclusion !== "not_listed");
  const missing = eligible.filter((row) => !row.direct_link);
  const inclusionLabels = { listed: "Listed in NHG", not_checked: "Not checked", unclear: "Unclear" };
  return reportResult({
    definition,
    summary: `${eligible.length} eligible monuments checked; ${missing.length} lack a confirmed direct NHG link.`,
    subtitle: "All sections · Plot markers included · Not listed in NHG excluded",
    columns: [
      { key: "cemetery", label: "Cemetery" }, { key: "section", label: "Section" },
      { key: "monument", label: "Monument ID" }, { key: "gravesites", label: "Gravesite name(s)" },
      { key: "nhg_inclusion", label: "NHG inclusion status" },
      { key: "marker_type", label: "Marker type" }, { key: "marker_scope", label: "Marker scope" },
    ],
    rows: missing.map((row) => ({
      ...row,
      monumentRecord: reportMonumentRecord(row),
      gravesites: row.gravesites || "Standalone monument",
      nhg_inclusion: inclusionLabels[row.nhg_inclusion] ?? "Not checked",
    })),
    notes: [
      "Checks links directly between monuments and NHG data. Only confirmed links (status linked) count; pending and rejected links do not count.",
      "Monuments marked Not listed in NHG are excluded from the results and checked total. Listed, Not checked, and Unclear monuments without confirmed links are included.",
      "Gravesite names identify the monument’s location; gravesites are not checked for NHG links.",
      "Includes active monuments in all sections, including plot markers. Standalone monuments use their map location. Deleted records and deleted monument/gravesite relationships are excluded.",
    ],
  });
}
