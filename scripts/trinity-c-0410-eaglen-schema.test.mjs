import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/361-split-c-0410-eaglen-gravesites.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);

test("C-0410 migration creates Elva's grave north of Ralph's without moving the marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0410'/u);
  assert.match(migration, /'0410A', 'TLC-GPS-0410-01'/u);
  assert.match(migration, /'Elva Eaglen'/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /geometry = replacement_geometries\.south_geometry/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
});

test("C-0410 migration assigns both linked Eaglen burials and shared-marker links", () => {
  assert.match(migration, /name = 'Ralph S Eaglen'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'ralph s eaglen'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'elva eaglen'/u);
  assert.match(migration, /headstone_burials\.headstone_uuid = marker_context\.headstone_uuid/u);
  assert.match(migration, /SELECT headstone_uuid, ralph_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, elva_gravesite_uuid, 'spans'/u);
});

test("C-0410 migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/361-split-c-0410-eaglen-gravesites\.sql/u);
});
