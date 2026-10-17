import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/370-split-a-0026-brandt-gravesites.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);

test("A-0026 migration creates Mary's grave north of Walter's without moving the marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0026'/u);
  assert.match(migration, /'0026A', 'TLC-GPS-0026-01'/u);
  assert.match(migration, /'Mary M Brandt'/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /geometry = replacement_geometries\.south_geometry/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
});

test("A-0026 migration assigns both linked Brandt burials and shared-marker links", () => {
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'walter c brandt'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'mary m brandt'/u);
  assert.match(migration, /SELECT headstone_uuid, walter_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, mary_gravesite_uuid, 'spans'/u);
  assert.doesNotMatch(migration, /(?:birth_date|death_date|burial_record_status_type_id)\s*=/u);
});

test("A-0026 migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/370-split-a-0026-brandt-gravesites\.sql/u);
});
