import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/131-split-c-0198-watenpool-gravesites.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("C-0198 Watenpool split assigns A Amelia north and Peter south", () => {
  assert.match(migration, /TLC-HS-0198/u);
  assert.match(migration, /TLC-GPS-0198-01/u);
  assert.match(migration, /TLC-GPS-0198-02/u);
  assert.match(migration, /'A Amelia Watenpool'/u);
  assert.match(migration, /'0198A'/u);
  assert.match(migration, /north_geometry/u);
  assert.match(migration, /'Peter Watenpool'/u);
  assert.match(migration, /'0198B'/u);
  assert.match(migration, /south_geometry/u);
});

test("C-0198 Watenpool split keeps marker fixed and spans both gravesites", () => {
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /headstones\.id = marker_context\.headstone_uuid/u);
  assert.doesNotMatch(migration, /longitude =/u);
  assert.doesNotMatch(migration, /latitude =/u);
});

test("C-0198 Watenpool split scopes burial movement through the marker link", () => {
  assert.match(migration, /watenpool_burials AS/u);
  assert.match(migration, /JOIN headstone_burials/u);
  assert.match(migration, /headstone_burials\.burial_uuid = burials\.id/u);
  assert.match(migration, /marker_context\.headstone_uuid = headstone_burials\.headstone_uuid/u);
  assert.match(migration, /WHERE burials\.id = watenpool_burials\.id/u);
});
