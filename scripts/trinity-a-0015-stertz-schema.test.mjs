import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/368-split-a-0015-stertz-gravesites.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);

test("A-0015 migration creates Emma's grave north of Alexander's without moving the marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0015'/u);
  assert.match(migration, /'0015A', 'TLC-GPS-0015-01'/u);
  assert.match(migration, /'Emma S Stertz'/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /geometry = replacement_geometries\.south_geometry/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
});

test("A-0015 migration assigns both linked Stertz burials and shared-marker links", () => {
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'alexander f stertz'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'emma s stertz'/u);
  assert.match(migration, /SELECT headstone_uuid, alexander_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, emma_gravesite_uuid, 'spans'/u);
  assert.match(migration, /unknown death date was preserved/u);
});

test("A-0015 migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/368-split-a-0015-stertz-gravesites\.sql/u);
});
