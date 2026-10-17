import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/360-split-c-0409-fisher-gravesites.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);

test("C-0409 migration creates Arlie's grave north of James's without moving the marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0409'/u);
  assert.match(migration, /'0409A', 'TLC-GPS-0409-01'/u);
  assert.match(migration, /'Arlie D Fisher'/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /geometry = replacement_geometries\.south_geometry/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
});

test("C-0409 migration assigns both linked Fisher burials and shared-marker links", () => {
  assert.match(migration, /name = 'James T Fisher'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'james t fisher'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'arlie d fisher'/u);
  assert.match(migration, /headstone_burials\.headstone_uuid = marker_context\.headstone_uuid/u);
  assert.match(migration, /SELECT headstone_uuid, james_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, arlie_gravesite_uuid, 'spans'/u);
});

test("C-0409 migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/360-split-c-0409-fisher-gravesites\.sql/u);
});
