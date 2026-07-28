import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../db/changelog/changes/267-split-c-0289-kummer-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("C-0289 Kummer split places Chester north, Margaret center, and George south", () => {
  assert.match(migration, /name = 'Margaret E Kummer'/u);
  assert.match(migration, /'Chester T Kummer'/u);
  assert.match(migration, /'George H Kummer'/u);
  assert.match(migration, /'0289A'/u);
  assert.match(migration, /'TLC-GPS-0289-01'/u);
  assert.match(migration, /'0289B'/u);
  assert.match(migration, /'TLC-GPS-0289-02'/u);
  assert.match(migration, /north_geometry/u);
  assert.match(migration, /center_geometry/u);
  assert.match(migration, /south_geometry/u);
});

test("C-0289 Kummer split keeps the marker fixed and spans all three gravesites", () => {
  assert.doesNotMatch(migration, /UPDATE headstones\s+SET\s+geometry/iu);
  assert.match(migration, /SELECT headstone_uuid, margaret_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, chester_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, george_gravesite_uuid, 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.margaret_gravesite_uuid/u);
});

test("C-0289 Kummer split scopes all burial movement through TLC-HS-0289", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0289'/u);
  assert.match(migration, /headstone_burials\.burial_uuid = burials\.id/u);
  assert.match(migration, /normalized_given_name = 'chester'/u);
  assert.match(migration, /normalized_given_name = 'george'/u);
  assert.match(migration, /normalized_given_name = 'margaret'/u);
});

test("C-0289 Kummer split migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/267-split-c-0289-kummer-gravesites\.sql/u);
});
