import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/225-split-c-0217-hague-gravesites.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");
const changelogPath = new URL("../db/changelog/db.changelog-root.yaml", import.meta.url);
const changelog = readFileSync(changelogPath, "utf8");

test("C-0217 Hague split keeps Julius in the original grave and places Katherine north", () => {
  assert.match(migration, /TLC-HS-0217/u);
  assert.match(migration, /Julius L Hague/u);
  assert.match(migration, /gravesite_id = 'TLC-GPS-0217'/u);
  assert.match(migration, /south_geometry/u);
  assert.match(migration, /Katherine M Hague/u);
  assert.match(migration, /'0217A'/u);
  assert.match(migration, /'TLC-GPS-0217-01'/u);
  assert.match(migration, /north_geometry/u);
});

test("C-0217 Hague split keeps the marker fixed and spans both gravesites", () => {
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /headstones\.id = marker_context\.headstone_uuid/u);
  assert.match(migration, /gravesite_uuid = marker_context\.julius_gravesite_uuid/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*longitude =/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*latitude =/u);
});

test("C-0217 Hague split scopes burial movement through TLC-HS-0217", () => {
  assert.match(migration, /JOIN headstone_burials/u);
  assert.match(migration, /marker_context\.headstone_uuid = headstone_burials\.headstone_uuid/u);
  assert.match(migration, /normalized_full_name = 'julius l hague'/u);
  assert.match(migration, /normalized_full_name = 'katherine m hague'/u);
});

test("C-0217 Hague split migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/225-split-c-0217-hague-gravesites\.sql/u);
});
