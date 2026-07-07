import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/220-split-c-0214-nesbitt-bartz-gravesites.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("C-0214 Nesbitt Bartz split assigns Hugh north and Linda south", () => {
  assert.match(migration, /TLC-HS-0214/u);
  assert.match(migration, /TLC-GPS-0214-01/u);
  assert.match(migration, /TLC-GPS-0214-02/u);
  assert.match(migration, /'Hugh Pinkerton Nesbitt'/u);
  assert.match(migration, /'0214A'/u);
  assert.match(migration, /north_geometry/u);
  assert.match(migration, /'Linda Nesbitt\/Bartz'/u);
  assert.match(migration, /'0214B'/u);
  assert.match(migration, /south_geometry/u);
});

test("C-0214 Nesbitt Bartz split keeps marker fixed and spans both gravesites", () => {
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /headstones\.id = marker_context\.headstone_uuid/u);
  assert.doesNotMatch(migration, /longitude =/u);
  assert.doesNotMatch(migration, /latitude =/u);
});

test("C-0214 Nesbitt Bartz split scopes burial movement through the marker link", () => {
  assert.match(migration, /nesbitt_bartz_burials AS/u);
  assert.match(migration, /JOIN headstone_burials/u);
  assert.match(migration, /headstone_burials\.burial_uuid = burials\.id/u);
  assert.match(migration, /marker_context\.headstone_uuid = headstone_burials\.headstone_uuid/u);
  assert.match(migration, /WHERE burials\.id = nesbitt_bartz_burials\.id/u);
});
