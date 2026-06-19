import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/116-split-c-0181-hieber-gravesites.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("C-0181 Hieber split assigns Anna north and David south", () => {
  assert.match(migration, /TLC-HS-0181/u);
  assert.match(migration, /TLC-GPS-0181-01/u);
  assert.match(migration, /TLC-GPS-0181-02/u);
  assert.match(migration, /'Anna C Hieber'/u);
  assert.match(migration, /'0181A'/u);
  assert.match(migration, /north_geometry/u);
  assert.match(migration, /'David L Hieber'/u);
  assert.match(migration, /'0181B'/u);
  assert.match(migration, /south_geometry/u);
});

test("C-0181 Hieber split links the fixed marker to both gravesites", () => {
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /headstones\.id = marker_context\.headstone_uuid/u);
  assert.doesNotMatch(migration, /longitude =/u);
  assert.doesNotMatch(migration, /latitude =/u);
});
