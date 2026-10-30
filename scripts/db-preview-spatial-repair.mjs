import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { artifactDirectory, readOnlyClient, spatialFingerprint, writePrivate } from "./lib/local-db-review.mjs";
import { previewHtml, previewSql, summarizePreview, validatePreviewOptions } from "./lib/spatial-repair-preview.mjs";

const { values } = parseArgs({ options: Object.fromEntries(["env", "table", "cemetery", "section", "srid", "gap-meters", "snap-meters", "worker-image"].map(k => [k, { type: "string" }])) });
const options = validatePreviewOptions(values);
const environment = options.env ?? process.env.APP_ENV ?? "dev";
const client = await readOnlyClient(environment);
try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const before = await spatialFingerprint(client);
  const section = (await client.query(`SELECT ST_X(ST_Centroid(geometry)) AS lon,ST_Y(ST_Centroid(geometry)) AS lat
    FROM sections WHERE cemetery_id=$1 AND name=$2 AND deleted_at IS NULL`, [options.cemetery, options.section])).rows;
  assert.equal(section.length, 1, "Select exactly one active section by its name.");
  const zone = Math.min(60, Math.max(1, Math.floor((section[0].lon + 180) / 6) + 1));
  assert.equal(options.srid, (section[0].lat >= 0 ? 32600 : 32700) + zone, "Use the UTM zone containing this section.");
  assert.ok(section[0].lat >= -80 && section[0].lat <= 84, "Section is outside UTM coverage.");
  const table = options.table;
  const invalid = (await client.query(`SELECT count(*)::int AS n FROM ${table}
    WHERE cemetery_id=$1 AND section_id=$2 AND deleted_at IS NULL AND geometry IS NOT NULL
    AND (ST_SRID(geometry)<>4326 OR ST_NDims(geometry)<>2 OR NOT ST_IsValid(geometry) OR ST_IsEmpty(geometry) OR GeometryType(geometry) NOT IN ('POLYGON','MULTIPOLYGON'))`, [options.cemetery, options.section])).rows[0].n;
  assert.equal(invalid, 0, "Source must contain valid, nonempty, two-dimensional EPSG:4326 polygons; review other geometries separately.");
  const params = [options.cemetery, options.section, options.srid];
  const inputs = (await client.query(`SELECT id,encode(ST_AsEWKB(ST_Transform(geometry,$3::integer)),'hex') AS wkb
    FROM ${table} WHERE cemetery_id=$1 AND section_id=$2 AND deleted_at IS NULL AND geometry IS NOT NULL ORDER BY id`, params)).rows;
  assert.ok(inputs.length > 0, "No active polygons in selected scope.");
  const image = options["worker-image"] ?? "cemetery-spatial-preview:geos314";
  const imageId = execFileSync("docker", ["image", "inspect", "--format", "{{.Id}}", image], { encoding: "utf8" }).trim();
  const worker = JSON.parse(execFileSync("docker", ["run", "--platform=linux/amd64", "--rm", "-i", "--network=none", "--read-only", "--cap-drop=ALL",
    "--security-opt=no-new-privileges", "--memory=512m", "--cpus=1", imageId], {
    input: JSON.stringify({ records: inputs, gap: options.gap, snap: options.snap }), encoding: "utf8", timeout: 120000, maxBuffer: 32 * 1024 * 1024,
  }));
  assert.deepEqual(worker.records.map(r => r.id), inputs.map(r => r.id), "Worker changed coverage identity/order.");
  params.push(JSON.stringify(worker.records));
  const records = (await client.query(previewSql(table), params)).rows;
  assert.ok(records.length > 0, "No active polygons in selected scope.");
  for (const r of records) {
    r.original_sha256 = createHash("sha256").update(Buffer.from(r.original_ewkb, "hex")).digest("hex");
    r.proposed_sha256 = createHash("sha256").update(Buffer.from(r.candidate_ewkb, "hex")).digest("hex");
    const roundTrip = (await client.query("SELECT encode(ST_AsEWKB(ST_GeomFromEWKB(decode($1,'hex'))),'hex')=$1 AS exact", [r.original_ewkb])).rows[0].exact;
    assert.ok(roundTrip, "Original EWKB cannot be reconstructed exactly.");
  }
  const markers = (await client.query(`SELECT headstone_id AS label,ST_AsGeoJSON(ST_Transform(geometry,$3::integer),15)::json AS geometry
    FROM headstones WHERE deleted_at IS NULL AND GeometryType(geometry)='POINT'
    AND ST_DWithin(ST_Transform(geometry,$3::integer),(SELECT ST_Transform(geometry,$3::integer) FROM sections WHERE cemetery_id=$1 AND name=$2 AND deleted_at IS NULL),10)
    ORDER BY id`, params.slice(0, 3))).rows;
  const after = await spatialFingerprint(client);
  assert.deepEqual(after, before, "Spatial source snapshot changed.");
  await client.query("COMMIT");
  // Check a fresh snapshot too, detecting concurrent application edits while generating candidates.
  assert.deepEqual(await spatialFingerprint(client), before, "Concurrent spatial edits detected; regenerate preview.");
  const data = { environment, createdAt: new Date().toISOString(), options, summary: summarizePreview(records),
    engine: { imageId, geos: worker.geos, algorithm: "GEOSCoverageCleanWithParams, longest-border merge" },
    versions: (await client.query("SELECT version(),PostGIS_Full_Version() AS postgis")).rows[0],
    sourceFingerprint: before, sourceRecordsUnchanged: true, records, markers };
  const output = artifactDirectory("spatial-preview", environment);
  writePrivate(output, "preview.json", data);
  for (const [name, key] of [["original.geojson", "original"], ["proposed.geojson", "proposed"]]) {
    writePrivate(output, name, { type: "FeatureCollection", features: records.map(r => ({ type: "Feature", id: r.id,
      properties: { label: r.label, confidence: r.geometry_confidence, original_sha256: r.original_sha256,
        changed_area_m2: r.changed_area_m2, candidate: key === "proposed" }, geometry: r[key] })) });
  }
  writePrivate(output, "preview.html", previewHtml(data));
  console.log(JSON.stringify({ environment, output, sourceRecordsUnchanged: true, ...data.summary }, null, 2));
} finally { await client.end(); }
