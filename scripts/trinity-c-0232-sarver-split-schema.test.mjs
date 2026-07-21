import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/229-split-c-0232-sarver-gravesites.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");
const changelogPath = new URL("../db/changelog/db.changelog-root.yaml", import.meta.url);
const changelog = readFileSync(changelogPath, "utf8");

test("C-0232 Sarver split keeps Philip in the original grave and places Catherine north", () => {
  assert.match(migration, /TLC-HS-0232/u);
  assert.match(migration, /Philip Sarver/u);
  assert.match(migration, /gravesite_id = 'TLC-GPS-0232'/u);
  assert.match(migration, /south_geometry/u);
  assert.match(migration, /Catherine Sarver/u);
  assert.match(migration, /'0232A'/u);
  assert.match(migration, /'TLC-GPS-0232-01'/u);
  assert.match(migration, /north_geometry/u);
});

test("C-0232 Sarver split keeps the marker fixed and spans both gravesites", () => {
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /headstones\.id = marker_context\.headstone_uuid/u);
  assert.match(migration, /gravesite_uuid = marker_context\.philip_gravesite_uuid/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*longitude =/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*latitude =/u);
});

test("C-0232 Sarver split scopes burial movement through TLC-HS-0232", () => {
  assert.match(migration, /JOIN headstone_burials/u);
  assert.match(migration, /marker_context\.headstone_uuid = headstone_burials\.headstone_uuid/u);
  assert.match(migration, /normalized_full_name = 'philip sarver'/u);
  assert.match(migration, /normalized_full_name = 'catherine sarver'/u);
});

test("C-0232 Sarver split migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/229-split-c-0232-sarver-gravesites\.sql/u);
});
