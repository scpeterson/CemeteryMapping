import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/110-align-section-a-gravesites-0038-0045-to-markers.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");
const correctionPath = new URL(
  "../db/changelog/changes/111-correct-section-a-gravesites-0038-0045-west-edge-marker-alignment.sql",
  import.meta.url,
);
const correction = readFileSync(correctionPath, "utf8");

test("Section A gravesite marker alignment targets A-0038 and A-0045 internal ids", () => {
  for (const expected of ["TLC-GPS-0038", "TLC-HS-0038", "TLC-GPS-0045", "TLC-HS-0045"]) {
    assert.match(migration, new RegExp(`'${expected}'`, "u"));
  }
});

test("Section A gravesite marker alignment centers the east edge on marker geometry", () => {
  assert.match(migration, /ST_X\(headstones\.geometry\) AS east_longitude/u);
  assert.match(migration, /ST_Y\(headstones\.geometry\) AS marker_latitude/u);
  assert.match(migration, /east_longitude - aligned_geometries\.width_longitude/u);
  assert.match(migration, /marker_latitude - \(aligned_geometries\.height_latitude \/ 2\.0\)/u);
  assert.match(migration, /marker_latitude \+ \(aligned_geometries\.height_latitude \/ 2\.0\)/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
});

test("Section A gravesite marker correction centers the west edge on marker geometry", () => {
  assert.match(correction, /ST_X\(headstones\.geometry\) AS west_longitude/u);
  assert.match(correction, /ST_Y\(headstones\.geometry\) AS marker_latitude/u);
  assert.match(correction, /aligned_geometries\.west_longitude,/u);
  assert.match(correction, /west_longitude \+ aligned_geometries\.width_longitude/u);
  assert.match(correction, /marker_latitude - \(aligned_geometries\.height_latitude \/ 2\.0\)/u);
  assert.match(correction, /marker_latitude \+ \(aligned_geometries\.height_latitude \/ 2\.0\)/u);
  assert.doesNotMatch(correction, /UPDATE headstones/u);
});
