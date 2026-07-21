import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/231-split-c-0235-soergel-gravesites.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");
const changelogPath = new URL("../db/changelog/db.changelog-root.yaml", import.meta.url);
const changelog = readFileSync(changelogPath, "utf8");

test("C-0235 Soergel split keeps Kenneth B in the original grave and places Clara Pearle north", () => {
  assert.match(migration, /TLC-HS-0235/u);
  assert.match(migration, /Kenneth B Soergel/u);
  assert.match(migration, /gravesite_id = 'TLC-GPS-0235'/u);
  assert.match(migration, /south_geometry/u);
  assert.match(migration, /Clara Pearle Soergel/u);
  assert.match(migration, /'0235A'/u);
  assert.match(migration, /'TLC-GPS-0235-01'/u);
  assert.match(migration, /north_geometry/u);
});

test("C-0235 Soergel split keeps the marker fixed and spans both gravesites", () => {
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /headstones\.id = marker_context\.headstone_uuid/u);
  assert.match(migration, /gravesite_uuid = marker_context\.kenneth_gravesite_uuid/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*longitude =/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*latitude =/u);
});

test("C-0235 Soergel split scopes burial movement through TLC-HS-0235", () => {
  assert.match(migration, /JOIN headstone_burials/u);
  assert.match(migration, /marker_context\.headstone_uuid = headstone_burials\.headstone_uuid/u);
  assert.match(migration, /normalized_full_name = 'kenneth b soergel'/u);
  assert.match(migration, /normalized_full_name = 'clara pearle soergel'/u);
});

test("C-0235 Soergel split classifies Clara Pearle as a living pre-need reservation", () => {
  assert.match(migration, /WHERE code = 'reserved'/u);
  assert.match(migration, /WHERE code = 'pre_need_inscription'/u);
  assert.match(migration, /burial_date = NULL/u);
  assert.match(migration, /WHERE code = 'interred'/u);
});

test("C-0235 Soergel split migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/231-split-c-0235-soergel-gravesites\.sql/u);
});
