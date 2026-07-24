import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../db/changelog/changes/252-split-c-0257-sarver-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("C-0257 Sarver split keeps James in the original grave and places Margaret north", () => {
  assert.match(migration, /name = 'James M Sarver'/u);
  assert.match(migration, /gravesite_id = 'TLC-GPS-0257'/u);
  assert.match(migration, /'Margaret E Sarver'/u);
  assert.match(migration, /'0257A'/u);
  assert.match(migration, /'TLC-GPS-0257-01'/u);
  assert.match(migration, /north_geometry/u);
  assert.match(migration, /south_geometry/u);
});

test("C-0257 Sarver split keeps the marker fixed and spans both gravesites", () => {
  assert.doesNotMatch(migration, /UPDATE headstones\s+SET\s+geometry/iu);
  assert.match(migration, /SELECT headstone_uuid, margaret_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, james_gravesite_uuid, 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.james_gravesite_uuid/u);
});

test("C-0257 Sarver split scopes burial movement through TLC-HS-0257", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0257'/u);
  assert.match(migration, /headstone_burials\.burial_uuid = burials\.id/u);
  assert.match(migration, /split_part\(trim\(COALESCE\(burials\.first_name/u);
  assert.match(migration, /normalized_given_name = 'margaret'/u);
  assert.match(migration, /normalized_given_name = 'james'/u);
});

test("C-0257 Sarver split migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/252-split-c-0257-sarver-gravesites\.sql/u);
});
