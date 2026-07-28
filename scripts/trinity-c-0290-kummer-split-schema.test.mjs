import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../db/changelog/changes/268-split-c-0290-kummer-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("C-0290 Kummer split keeps Dora south and places Christ north", () => {
  assert.match(migration, /name = 'Dora Kummer'/u);
  assert.match(migration, /gravesite_id = 'TLC-GPS-0290'/u);
  assert.match(migration, /'Christ Kummer'/u);
  assert.match(migration, /'0290A'/u);
  assert.match(migration, /'TLC-GPS-0290-01'/u);
  assert.match(migration, /north_geometry/u);
  assert.match(migration, /south_geometry/u);
});

test("C-0290 Kummer split keeps the marker fixed and spans both gravesites", () => {
  assert.doesNotMatch(migration, /UPDATE headstones\s+SET\s+geometry/iu);
  assert.match(migration, /SELECT headstone_uuid, dora_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, christ_gravesite_uuid, 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.dora_gravesite_uuid/u);
});

test("C-0290 Kummer split scopes burial movement through TLC-HS-0290", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0290'/u);
  assert.match(migration, /headstone_burials\.burial_uuid = burials\.id/u);
  assert.match(migration, /normalized_given_name = 'dora'/u);
  assert.match(migration, /normalized_given_name = 'christ'/u);
});

test("C-0290 Kummer split migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/268-split-c-0290-kummer-gravesites\.sql/u);
});
