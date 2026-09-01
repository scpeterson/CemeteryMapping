import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/363-split-c-0416-sarver-gravesites.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);

test("C-0416 migration creates Ellen's grave north of Howard's without moving the marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0416'/u);
  assert.match(migration, /'0416A', 'TLC-GPS-0416-01'/u);
  assert.match(migration, /'Ellen Clara Sarver'/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /geometry = replacement_geometries\.south_geometry/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
});

test("C-0416 migration assigns both linked Sarver burials and shared-marker links", () => {
  assert.match(migration, /name = 'Howard L Sarver'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'howard l sarver'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'ellen clara sarver'/u);
  assert.match(migration, /headstone_burials\.headstone_uuid = marker_context\.headstone_uuid/u);
  assert.match(migration, /SELECT headstone_uuid, howard_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, ellen_gravesite_uuid, 'spans'/u);
});

test("C-0416 migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/363-split-c-0416-sarver-gravesites\.sql/u);
});
