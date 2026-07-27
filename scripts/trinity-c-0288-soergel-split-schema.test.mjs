import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../db/changelog/changes/266-split-c-0288-soergel-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("C-0288 Soergel split keeps Peter in the original grave and places Margaret north", () => {
  assert.match(migration, /name = 'Peter Soergel'/u);
  assert.match(migration, /gravesite_id = 'TLC-GPS-0288'/u);
  assert.match(migration, /'Margaret Soergel'/u);
  assert.match(migration, /'0288A'/u);
  assert.match(migration, /'TLC-GPS-0288-01'/u);
  assert.match(migration, /north_geometry/u);
  assert.match(migration, /south_geometry/u);
});

test("C-0288 Soergel split keeps the marker fixed and spans both gravesites", () => {
  assert.doesNotMatch(migration, /UPDATE headstones\s+SET\s+geometry/iu);
  assert.match(migration, /SELECT headstone_uuid, margaret_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, peter_gravesite_uuid, 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.peter_gravesite_uuid/u);
});

test("C-0288 Soergel split scopes burial movement through TLC-HS-0288", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0288'/u);
  assert.match(migration, /headstone_burials\.burial_uuid = burials\.id/u);
  assert.match(migration, /split_part\(trim\(COALESCE\(burials\.first_name/u);
  assert.match(migration, /normalized_given_name = 'margaret'/u);
  assert.match(migration, /normalized_given_name = 'peter'/u);
});

test("C-0288 Soergel split migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/266-split-c-0288-soergel-gravesites\.sql/u);
});
