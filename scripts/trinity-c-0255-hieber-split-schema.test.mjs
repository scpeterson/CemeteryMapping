import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../db/changelog/changes/248-split-c-0255-hieber-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("C-0255 Hieber split keeps George in the original grave and places Olive north", () => {
  assert.match(migration, /name = 'George Hieber'/u);
  assert.match(migration, /gravesite_id = 'TLC-GPS-0255'/u);
  assert.match(migration, /'Olive Hieber'/u);
  assert.match(migration, /'0255A'/u);
  assert.match(migration, /'TLC-GPS-0255-01'/u);
  assert.match(migration, /north_geometry/u);
  assert.match(migration, /south_geometry/u);
});

test("C-0255 Hieber split keeps the marker fixed and spans both gravesites", () => {
  assert.doesNotMatch(migration, /UPDATE headstones\s+SET\s+geometry/iu);
  assert.match(migration, /SELECT headstone_uuid, olive_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, george_gravesite_uuid, 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.george_gravesite_uuid/u);
});

test("C-0255 Hieber split scopes burial movement through TLC-HS-0255", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0255'/u);
  assert.match(migration, /headstone_burials\.burial_uuid = burials\.id/u);
  assert.match(migration, /normalized_first_name = 'olive'/u);
  assert.match(migration, /normalized_first_name = 'george'/u);
});

test("C-0255 Hieber split migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/248-split-c-0255-hieber-gravesites\.sql/u);
});
