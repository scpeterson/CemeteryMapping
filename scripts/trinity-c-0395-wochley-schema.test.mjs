import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/353-split-c-0395-wochley-gravesites.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);

test("C-0395 migration creates Luceil's grave north of Arthur's without moving the marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0395'/u);
  assert.match(migration, /'0395A', 'TLC-GPS-0395-01'/u);
  assert.match(migration, /'Luceil Wochley'/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /cost, north_geometry/u);
  assert.match(migration, /geometry = replacement_geometries\.south_geometry/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*(?:longitude|latitude)\s*=/u);
});

test("C-0395 migration assigns both linked Wochley burials and shared-marker links", () => {
  assert.match(migration, /name = 'Arthur Dennis Wochley'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'arthur dennis wochley'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'luceil wochley'/u);
  assert.match(migration, /headstone_burials\.headstone_uuid = marker_context\.headstone_uuid/u);
  assert.match(migration, /SELECT headstone_uuid, arthur_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, luceil_gravesite_uuid, 'spans'/u);
  assert.match(migration, /INSERT INTO headstone_burials/u);
});

test("C-0395 migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/353-split-c-0395-wochley-gravesites\.sql/u);
});
