import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/367-split-a-0012-seeke-gravesites.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);

test("A-0012 migration creates Marie's grave north of Frederick's without moving the marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0012'/u);
  assert.match(migration, /'0012A', 'TLC-GPS-0012-01'/u);
  assert.match(migration, /'Marie Seeke'/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /geometry = replacement_geometries\.south_geometry/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
});

test("A-0012 migration corrects Frederick's name and assigns both linked burials", () => {
  assert.match(migration, /first_name = 'Frederick', full_name = 'Frederick Seeke'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'frekerick seeke'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'marie seeke'/u);
  assert.match(migration, /SELECT headstone_uuid, frederick_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, marie_gravesite_uuid, 'spans'/u);
});

test("A-0012 migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/367-split-a-0012-seeke-gravesites\.sql/u);
});
