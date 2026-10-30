import { readFileSync } from "node:fs";

export function validatePreviewOptions(options) {
  if (!["lots", "gravesites"].includes(options.table)) throw new Error("--table must be lots or gravesites.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(options.cemetery ?? "")) throw new Error("--cemetery must be a UUID.");
  if (!options.section?.trim()) throw new Error("--section is required; previews must be explicitly scoped.");
  const srid = Number(options.srid), gap = Number(options["gap-meters"] ?? 0), snap = Number(options["snap-meters"] ?? 0);
  // UTM is deliberately required: tolerances and change metrics must use meters.
  if (!Number.isInteger(srid) || !(srid >= 32601 && srid <= 32660 || srid >= 32701 && srid <= 32760)) throw new Error("--srid must be a WGS84 UTM zone (32601–32660 or 32701–32760).");
  if (![gap, snap].every(n => Number.isFinite(n) && n >= 0 && n <= 0.1)) throw new Error("Gap and snap tolerances must be between 0 and 0.1 meters.");
  return { ...options, srid, gap, snap };
}

export function previewSql(table) {
  if (!["lots", "gravesites"].includes(table)) throw new Error("Unsupported table.");
  const parent = table === "lots" ? "sections" : "lots";
  const parentKey = table === "lots" ? "section_id" : "id";
  const foreignKey = table === "lots" ? "section_uuid" : "lot_uuid";
  const label = table === "lots" ? "section_id||'-'||lot_id" : "gravesite_id";
  return `WITH source AS MATERIALIZED (
    SELECT id,${label} AS label,geometry,geometry_confidence,geometry_source,${foreignKey} AS parent_id,
      ST_Transform(geometry,$3::integer) AS projected,encode(ST_AsEWKB(geometry),'hex') AS original_ewkb
    FROM ${table} WHERE cemetery_id=$1 AND section_id=$2 AND deleted_at IS NULL AND geometry IS NOT NULL
    ORDER BY id
  ), cleaned AS MATERIALIZED (
    SELECT source.*,ST_SetSRID(ST_GeomFromEWKB(decode(proposals.ewkb,'hex')),$3::integer) AS candidate
      FROM source JOIN jsonb_to_recordset($4::jsonb) AS proposals(id uuid,ewkb text) USING(id)
  ) SELECT c.id,c.label,c.geometry_confidence,c.geometry_source,c.parent_id,c.original_ewkb,
    encode(ST_AsEWKB(ST_Multi(ST_Transform(c.candidate,4326))),'hex') AS candidate_ewkb,
    ST_AsGeoJSON(c.geometry,15)::json AS original,ST_AsGeoJSON(ST_Multi(ST_Transform(c.candidate,4326)),15)::json AS proposed,
    ST_AsGeoJSON(c.projected,15)::json AS original_plot,ST_AsGeoJSON(c.candidate,15)::json AS proposed_plot,
    ST_IsValid(c.candidate) AS valid,ST_IsEmpty(c.candidate) AS empty,
    (SELECT count(*)::int FROM headstones h WHERE ${table === 'gravesites' ? 'true' : 'false'} AND h.deleted_at IS NULL AND h.geometry IS NOT NULL
      AND (h.gravesite_uuid=c.id OR EXISTS(SELECT 1 FROM headstone_gravesites hg WHERE hg.headstone_uuid=h.id AND hg.gravesite_uuid=c.id AND hg.deleted_at IS NULL))
      AND ST_Covers(c.projected,ST_Transform(h.geometry,$3::integer))
      AND NOT ST_Covers(c.candidate,ST_Transform(h.geometry,$3::integer))) AS linked_markers_losing_coverage,
    ST_Area(c.projected) AS original_area_m2,ST_Area(c.candidate) AS proposed_area_m2,
    ST_Area(ST_SymDifference(c.projected,c.candidate)) AS changed_area_m2,
    ST_HausdorffDistance(c.projected,c.candidate) AS hausdorff_m,
    CASE WHEN p.geometry IS NOT NULL THEN ST_Area(ST_Difference(c.projected,ST_Transform(p.geometry,$3::integer))) END AS outside_parent_before_m2,
    CASE WHEN p.geometry IS NOT NULL THEN ST_Area(ST_Difference(c.candidate,ST_Transform(p.geometry,$3::integer))) END AS outside_parent_after_m2,
    (SELECT count(*)::int FROM cleaned b WHERE c.id<b.id AND ST_Area(ST_Intersection(c.projected,b.projected))>0.00000001) AS overlap_pairs_before,
    (SELECT count(*)::int FROM cleaned b WHERE c.id<b.id AND ST_Area(ST_Intersection(c.candidate,b.candidate))>0.00000001) AS overlap_pairs_after
    FROM cleaned c LEFT JOIN ${parent} p ON p.${parentKey}=c.parent_id ORDER BY c.id`;
}

export function summarizePreview(records) {
  return {
    records: records.length,
    changed: records.filter(r => r.changed_area_m2 > 1e-8).length,
    invalidOrEmpty: records.filter(r => !r.valid || r.empty).length,
    protectedGeometryChanges: records.filter(r => r.geometry_confidence !== "estimated" && r.changed_area_m2 > 1e-8).length,
    overlapPairsBefore: records.reduce((n, r) => n + r.overlap_pairs_before, 0),
    overlapPairsAfter: records.reduce((n, r) => n + r.overlap_pairs_after, 0),
    parentContainmentWorsened: records.filter(r => r.outside_parent_after_m2 - r.outside_parent_before_m2 > 1e-6).length,
    recordsDisplacedOver10cm: records.filter(r => r.hausdorff_m > 0.1).length,
    linkedMarkersLosingCoverage: records.reduce((n, r) => n + (r.linked_markers_losing_coverage ?? 0), 0),
    maxHausdorffMeters: Math.max(0, ...records.map(r => r.hausdorff_m ?? 0)),
    changedAreaSquareMeters: records.reduce((n, r) => n + r.changed_area_m2, 0),
    approval: "Unreviewed candidates only. This tool has no apply command. Originals and exact EWKB are retained; existing geometry is never updated.",
  };
}

export function previewHtml(data) {
  const json = JSON.stringify(data).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Spatial repair preview</title><style>body{font:16px system-ui;margin:24px;color:#172b35;background:#f4f7f8}header{max-width:1000px}label{display:inline-block;margin:8px 16px 8px 0}canvas{display:block;width:100%;height:65vh;background:white;border:1px solid #c5d2d8}pre{white-space:pre-wrap}select{max-width:100%;padding:8px}#metrics{font:14px monospace} .note{color:#653b00}</style>
<header><h1>Spatial repair preview</h1><p class="note">Unreviewed candidates. Existing geometry and marker locations are unchanged. Orange outlines are proposals, not approved boundaries.</p><p id="scope"></p><p id="review-warning" class="note"></p>
<label><input id="original" type="checkbox" checked> Original (blue)</label><label><input id="proposed" type="checkbox" checked> Proposed (orange)</label><label><input id="markers" type="checkbox" checked> Fixed marker context (green)</label><label><input id="labels" type="checkbox"> Labels</label><br><label>Inspect record <select id="record"><option value="">All records</option></select></label><p id="metrics"></p></header><canvas aria-label="Original and proposed polygons, north upwards"></canvas><h2>Candidate summary</h2><pre id="summary"></pre>
<script type="application/json" id="data">${json}</script><script>${readFileSync(new URL("../spatial-preview/viewer.js", import.meta.url), "utf8")}</script></html>`;
}
