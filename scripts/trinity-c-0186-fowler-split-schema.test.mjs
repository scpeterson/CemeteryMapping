import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/118-split-c-0186-fowler-gravesites.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("C-0186 Fowler split assigns Helen north and Chester south", () => {
  assert.match(migration, /TLC-HS-0186/u);
  assert.match(migration, /TLC-GPS-0186-01/u);
  assert.match(migration, /TLC-GPS-0186-02/u);
  assert.match(migration, /'Helen E Fowler'/u);
  assert.match(migration, /'0186A'/u);
  assert.match(migration, /north_geometry/u);
  assert.match(migration, /'Chester J Fowler'/u);
  assert.match(migration, /'0186B'/u);
  assert.match(migration, /south_geometry/u);
});

test("C-0186 Fowler split links the fixed marker to both gravesites", () => {
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /headstones\.id = marker_context\.headstone_uuid/u);
  assert.doesNotMatch(migration, /longitude =/u);
  assert.doesNotMatch(migration, /latitude =/u);
});
