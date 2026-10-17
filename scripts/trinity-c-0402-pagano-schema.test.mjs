import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/358-split-c-0402-pagano-gravesites.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);

test("C-0402 migration creates Pat's grave north of Constance's without moving the marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0402'/u);
  assert.match(migration, /'0402A', 'TLC-GPS-0402-01'/u);
  assert.match(migration, /'Pat Pagano'/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /geometry = replacement_geometries\.south_geometry/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
});

test("C-0402 migration assigns both linked Pagano burials and shared-marker links", () => {
  assert.match(migration, /name = 'Constance "Connie" Pagano'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'constance "connie" pagano'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'pat pagano'/u);
  assert.match(migration, /headstone_burials\.headstone_uuid = marker_context\.headstone_uuid/u);
  assert.match(migration, /SELECT headstone_uuid, constance_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, pat_gravesite_uuid, 'spans'/u);
});

test("C-0402 migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/358-split-c-0402-pagano-gravesites\.sql/u);
});
