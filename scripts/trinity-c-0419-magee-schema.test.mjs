import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/356-split-c-0419-magee-gravesites.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);

test("C-0419 migration creates Jeannette's grave north of Ralph's without moving the marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0419'/u);
  assert.match(migration, /'0419A', 'TLC-GPS-0419-01'/u);
  assert.match(migration, /'Jeannette B Magee'/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /geometry = replacement_geometries\.south_geometry/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
});

test("C-0419 migration assigns both linked Magee burials and shared-marker links", () => {
  assert.match(migration, /name = 'Ralph C Magee Jr\.'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'ralph c magee jr\.'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'jeannette b magee'/u);
  assert.match(migration, /headstone_burials\.headstone_uuid = marker_context\.headstone_uuid/u);
  assert.match(migration, /SELECT headstone_uuid, ralph_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, jeannette_gravesite_uuid, 'spans'/u);
});

test("C-0419 migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/356-split-c-0419-magee-gravesites\.sql/u);
});
