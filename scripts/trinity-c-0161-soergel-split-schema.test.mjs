import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../db/changelog/changes/240-split-c-0161-soergel-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("C-0161 Soergel split keeps Warren in the original grave and places C Jean north", () => {
  assert.match(migration, /name = 'Warren A Soergel'/u);
  assert.match(migration, /gravesite_id = 'TLC-GPS-0161'/u);
  assert.match(migration, /'C Jean Soergel'/u);
  assert.match(migration, /'0161A'/u);
  assert.match(migration, /'TLC-GPS-0161-01'/u);
  assert.match(migration, /north_geometry/u);
  assert.match(migration, /south_geometry/u);
});

test("C-0161 Soergel split keeps the marker fixed and spans both gravesites", () => {
  assert.doesNotMatch(migration, /UPDATE headstones\s+SET\s+geometry/iu);
  assert.match(migration, /SELECT headstone_uuid, jean_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, warren_gravesite_uuid, 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.warren_gravesite_uuid/u);
});

test("C-0161 Soergel split scopes burial movement through TLC-HS-0161", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0161'/u);
  assert.match(migration, /headstone_burials\.burial_uuid = burials\.id/u);
  assert.match(migration, /normalized_first_name = 'c jean'/u);
  assert.match(migration, /normalized_first_name = 'warren a'/u);
});

test("C-0161 Soergel split migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/240-split-c-0161-soergel-gravesites\.sql/u);
});
