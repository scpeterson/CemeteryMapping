import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/333-split-c-0360-berkshire-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("C-0360 split keeps Robert in the original southern grave and places Lillian north", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0360'/u);
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /name = 'Robert J Berkshire'[\s\S]*geometry = replacement_geometries\.south_geometry/u);
  assert.match(migration, /'Lillian S Berkshire'[\s\S]*'0360A'[\s\S]*'TLC-GPS-0360-01'[\s\S]*north_geometry/u);
});

test("C-0360 split assigns both burials and spans both graves without moving the marker", () => {
  assert.match(migration, /full_name, ''\)\) = 'robert j berkshire'/u);
  assert.match(migration, /full_name, ''\)\) = 'lillian s berkshire'/u);
  assert.match(migration, /headstone_burials\.headstone_uuid = marker_context\.headstone_uuid/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.robert_gravesite_uuid/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry =/u);
});

test("C-0360 split asserts its sources and is included in the root changelog", () => {
  assert.match(migration, /assert_migration_prerequisite/u);
  assert.match(migration, /gravesite_id IN \('TLC-GPS-0359', 'TLC-GPS-0361'\)/u);
  assert.match(migration, /exactly one active Robert J Berkshire burial and one active Lillian S Berkshire burial/u);
  assert.match(rootChangelog, /changes\/333-split-c-0360-berkshire-gravesites\.sql/u);
});
