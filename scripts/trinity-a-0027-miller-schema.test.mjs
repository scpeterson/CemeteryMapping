import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/369-split-a-0027-miller-gravesites.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);

test("A-0027 migration creates Martha's grave north of Charles's without moving the marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0027'/u);
  assert.match(migration, /'0027A', 'TLC-GPS-0027-01'/u);
  assert.match(migration, /'Martha B Miller'/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /geometry = replacement_geometries\.south_geometry/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
});

test("A-0027 migration assigns both linked Miller burials and shared-marker links", () => {
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'charles "cart" miller'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'martha b miller'/u);
  assert.match(migration, /SELECT headstone_uuid, charles_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, martha_gravesite_uuid, 'spans'/u);
  assert.doesNotMatch(migration, /(?:birth_date|death_date|burial_record_status_type_id)\s*=/u);
});

test("A-0027 migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/369-split-a-0027-miller-gravesites\.sql/u);
});
