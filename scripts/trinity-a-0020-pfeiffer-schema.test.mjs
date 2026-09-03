import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/371-split-a-0020-pfeiffer-gravesites.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);

test("A-0020 migration creates Edna's grave north of Edward's without moving the marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0020'/u);
  assert.match(migration, /'0020A', 'TLC-GPS-0020-01'/u);
  assert.match(migration, /'Edna M Pfeiffer'/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /geometry = replacement_geometries\.south_geometry/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
});

test("A-0020 migration assigns both linked Pfeiffer burials and shared-marker links", () => {
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'edward g pfeiffer'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'edna m pfeiffer'/u);
  assert.match(migration, /SELECT headstone_uuid, edward_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, edna_gravesite_uuid, 'spans'/u);
  assert.doesNotMatch(migration, /(?:birth_date|death_date|burial_record_status_type_id)\s*=/u);
});

test("A-0020 migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/371-split-a-0020-pfeiffer-gravesites\.sql/u);
});
