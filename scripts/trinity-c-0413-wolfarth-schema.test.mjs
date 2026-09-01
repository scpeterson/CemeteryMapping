import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/362-split-c-0413-wolfarth-gravesites.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);

test("C-0413 migration creates Raymond's grave north of Theresa's without moving the marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0413'/u);
  assert.match(migration, /'0413A', 'TLC-GPS-0413-01'/u);
  assert.match(migration, /'Raymond A Wolfarth'/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /geometry = replacement_geometries\.south_geometry/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
});

test("C-0413 migration assigns both linked Wolfarth burials and shared-marker links", () => {
  assert.match(migration, /name = 'Theresa P Wolfarth'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'theresa p wolfarth'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'raymond a wolfarth'/u);
  assert.match(migration, /headstone_burials\.headstone_uuid = marker_context\.headstone_uuid/u);
  assert.match(migration, /SELECT headstone_uuid, theresa_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, raymond_gravesite_uuid, 'spans'/u);
});

test("C-0413 migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/362-split-c-0413-wolfarth-gravesites\.sql/u);
});
