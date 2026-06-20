import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/123-split-c-0190-kempf-gravesites.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("C-0190 Kempf split assigns Anna north and Peter south", () => {
  assert.match(migration, /TLC-HS-0190/u);
  assert.match(migration, /TLC-GPS-0190-01/u);
  assert.match(migration, /TLC-GPS-0190-02/u);
  assert.match(migration, /'Anna Kempf'/u);
  assert.match(migration, /'0190A'/u);
  assert.match(migration, /north_geometry/u);
  assert.match(migration, /'Peter Kempf'/u);
  assert.match(migration, /'0190B'/u);
  assert.match(migration, /south_geometry/u);
});

test("C-0190 Kempf split keeps marker fixed and spans both gravesites", () => {
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /headstones\.id = marker_context\.headstone_uuid/u);
  assert.doesNotMatch(migration, /longitude =/u);
  assert.doesNotMatch(migration, /latitude =/u);
});
