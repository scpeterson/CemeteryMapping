import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/355-split-c-0398-luster-gravesites.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);

test("C-0398 migration creates Mary's grave north of George's without moving the marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0398'/u);
  assert.match(migration, /'0398A', 'TLC-GPS-0398-01'/u);
  assert.match(migration, /'Mary L Luster'/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /cost, north_geometry/u);
  assert.match(migration, /geometry = replacement_geometries\.south_geometry/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
});

test("C-0398 migration assigns both linked Luster burials and shared-marker links", () => {
  assert.match(migration, /name = 'George William Luster'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'george william luster'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'mary l luster'/u);
  assert.match(migration, /headstone_burials\.headstone_uuid = marker_context\.headstone_uuid/u);
  assert.match(migration, /SELECT headstone_uuid, george_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, mary_gravesite_uuid, 'spans'/u);
});

test("C-0398 migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/355-split-c-0398-luster-gravesites\.sql/u);
});
