import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/125-split-c-0192-will-gravesites.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("C-0192 Will split assigns Elva north and Albert south", () => {
  assert.match(migration, /TLC-HS-0192/u);
  assert.match(migration, /TLC-GPS-0192-01/u);
  assert.match(migration, /TLC-GPS-0192-02/u);
  assert.match(migration, /'Elva Z Will'/u);
  assert.match(migration, /'0192A'/u);
  assert.match(migration, /north_geometry/u);
  assert.match(migration, /'Albert R Will'/u);
  assert.match(migration, /'0192B'/u);
  assert.match(migration, /south_geometry/u);
});

test("C-0192 Will split keeps marker fixed and spans both gravesites", () => {
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /headstones\.id = marker_context\.headstone_uuid/u);
  assert.doesNotMatch(migration, /longitude =/u);
  assert.doesNotMatch(migration, /latitude =/u);
});

test("C-0192 Will split scopes burial movement through the marker link", () => {
  assert.match(migration, /will_burials AS/u);
  assert.match(migration, /JOIN headstone_burials/u);
  assert.match(migration, /headstone_burials\.burial_uuid = burials\.id/u);
  assert.match(migration, /marker_context\.headstone_uuid = headstone_burials\.headstone_uuid/u);
  assert.match(migration, /WHERE burials\.id = will_burials\.id/u);
});
