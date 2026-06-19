import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/120-burial-record-status-and-split-c-0188.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("C-0188 Jancosko split assigns Carol north and Ronald south", () => {
  assert.match(migration, /TLC-HS-0188/u);
  assert.match(migration, /TLC-GPS-0188-01/u);
  assert.match(migration, /TLC-GPS-0188-02/u);
  assert.match(migration, /'Carol Lynne Jancosko'/u);
  assert.match(migration, /'0188A'/u);
  assert.match(migration, /north_geometry/u);
  assert.match(migration, /'Ronald Michael Jancosko'/u);
  assert.match(migration, /'0188B'/u);
  assert.match(migration, /south_geometry/u);
});

test("C-0188 Jancosko split keeps marker fixed and records Ronald as pre-need", () => {
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /pre_need_inscription/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /headstones\.id = marker_context\.headstone_uuid/u);
  assert.doesNotMatch(migration, /longitude =/u);
  assert.doesNotMatch(migration, /latitude =/u);
});
