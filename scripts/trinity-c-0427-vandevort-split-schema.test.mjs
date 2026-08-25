import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/334-split-c-0427-vandevort-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("C-0427 split keeps David in the original southern grave and places Mildred north", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0427'/u);
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /name = 'David Lynn Vandevort'[\s\S]*geometry = replacement_geometries\.south_geometry/u);
  assert.match(migration, /'Mildred Abbott Vandevort'[\s\S]*'0427A'[\s\S]*'TLC-GPS-0427-01'[\s\S]*north_geometry/u);
});

test("C-0427 split assigns both burials and spans both graves without moving the marker", () => {
  assert.match(migration, /full_name, ''\)\) = 'david lynn vandevort'/u);
  assert.match(migration, /full_name, ''\)\) = 'mildred abbott vandevort'/u);
  assert.match(migration, /headstone_burials\.headstone_uuid = marker_context\.headstone_uuid/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.david_gravesite_uuid/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry =/u);
});

test("C-0427 split asserts its sources and is included in the root changelog", () => {
  assert.match(migration, /assert_migration_prerequisite/u);
  assert.match(migration, /gravesite_id IN \('TLC-GPS-0426', 'TLC-GPS-0428'\)/u);
  assert.match(migration, /exactly one active David Lynn Vandevort burial and one active Mildred Abbott Vandevort burial/u);
  assert.match(rootChangelog, /changes\/334-split-c-0427-vandevort-gravesites\.sql/u);
});
