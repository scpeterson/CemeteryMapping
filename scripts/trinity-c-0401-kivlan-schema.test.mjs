import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/357-split-c-0401-kivlan-gravesites.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);

test("C-0401 migration creates Grace's grave north of Harold's without moving the marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0401'/u);
  assert.match(migration, /'0401A', 'TLC-GPS-0401-01'/u);
  assert.match(migration, /'Grace C Kivlan'/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /geometry = replacement_geometries\.south_geometry/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
});

test("C-0401 migration assigns both linked Kivlan burials and shared-marker links", () => {
  assert.match(migration, /name = 'Harold B Kivlan Jr\.'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'harold b kivlan jr\.'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'grace c kivlan'/u);
  assert.match(migration, /headstone_burials\.headstone_uuid = marker_context\.headstone_uuid/u);
  assert.match(migration, /SELECT headstone_uuid, harold_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, grace_gravesite_uuid, 'spans'/u);
});

test("C-0401 migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/357-split-c-0401-kivlan-gravesites\.sql/u);
});
