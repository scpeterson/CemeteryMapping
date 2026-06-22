import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/139-split-c-0205-wills-broerman-gravesites.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("C-0205 Wills Broerman split assigns Elizabeth north and Frank south", () => {
  assert.match(migration, /TLC-HS-0205/u);
  assert.match(migration, /TLC-GPS-0205-01/u);
  assert.match(migration, /TLC-GPS-0205-02/u);
  assert.match(migration, /'Elizabeth Wills Broerman'/u);
  assert.match(migration, /'0205A'/u);
  assert.match(migration, /north_geometry/u);
  assert.match(migration, /'Frank Wills'/u);
  assert.match(migration, /'0205B'/u);
  assert.match(migration, /south_geometry/u);
});

test("C-0205 Wills Broerman split keeps marker fixed and spans both gravesites", () => {
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /headstones\.id = marker_context\.headstone_uuid/u);
  assert.doesNotMatch(migration, /longitude =/u);
  assert.doesNotMatch(migration, /latitude =/u);
});

test("C-0205 Wills Broerman split scopes burial movement through the marker link", () => {
  assert.match(migration, /wills_broerman_burials AS/u);
  assert.match(migration, /JOIN headstone_burials/u);
  assert.match(migration, /headstone_burials\.burial_uuid = burials\.id/u);
  assert.match(migration, /marker_context\.headstone_uuid = headstone_burials\.headstone_uuid/u);
  assert.match(migration, /WHERE burials\.id = wills_broerman_burials\.id/u);
});
