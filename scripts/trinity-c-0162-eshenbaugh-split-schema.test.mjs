import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../db/changelog/changes/247-split-c-0162-eshenbaugh-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("C-0162 Eshenbaugh split keeps Donald in the original grave and places Ella north", () => {
  assert.match(migration, /name = 'Donald L Eshenbaugh'/u);
  assert.match(migration, /gravesite_id = 'TLC-GPS-0162'/u);
  assert.match(migration, /'Ella M Ford Eshenbaugh'/u);
  assert.match(migration, /'0162A'/u);
  assert.match(migration, /'TLC-GPS-0162-01'/u);
  assert.match(migration, /north_geometry/u);
  assert.match(migration, /south_geometry/u);
  assert.match(migration, /maiden_name = 'Ford'/u);
});

test("C-0162 Eshenbaugh split keeps the marker fixed and spans both gravesites", () => {
  assert.doesNotMatch(migration, /UPDATE headstones\s+SET\s+geometry/iu);
  assert.match(migration, /SELECT headstone_uuid, ella_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, donald_gravesite_uuid, 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.donald_gravesite_uuid/u);
});

test("C-0162 Eshenbaugh split scopes burial movement through TLC-HS-0162", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0162'/u);
  assert.match(migration, /headstone_burials\.burial_uuid = burials\.id/u);
  assert.match(migration, /normalized_first_name = 'ella m'/u);
  assert.match(migration, /normalized_first_name = 'donald l'/u);
});

test("C-0162 Eshenbaugh split migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/247-split-c-0162-eshenbaugh-gravesites\.sql/u);
});
