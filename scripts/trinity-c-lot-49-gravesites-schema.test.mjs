import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/132-fit-c-0195-through-c-0198-into-lot-49.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");
const clipMigrationPath = new URL("../db/changelog/changes/133-clip-c-49-gravesites-to-lot-polygon.sql", import.meta.url);
const clipMigration = readFileSync(clipMigrationPath, "utf8");

test("Section C lot 49 migration fits five gravesites from south to north", () => {
  assert.match(migration, /lots\.lot_id = '49'/u);
  assert.match(migration, /'TLC-GPS-0195', '0195', 0/u);
  assert.match(migration, /'TLC-GPS-0196', '0196', 1/u);
  assert.match(migration, /'TLC-GPS-0197', '0197', 2/u);
  assert.match(migration, /'TLC-GPS-0198-02', '0198B', 3/u);
  assert.match(migration, /'TLC-GPS-0198-01', '0198A', 4/u);
});

test("Section C lot 49 migration derives gravesite slices from the lot polygon", () => {
  assert.match(migration, /north_latitude - south_latitude\) \/ 5/u);
  assert.match(migration, /ST_MakeEnvelope/u);
  assert.match(migration, /grave_height \* target_gravesites\.sort_order/u);
  assert.match(migration, /grave_height \* \(target_gravesites\.sort_order \+ 1\)/u);
});

test("Section C lot 49 migration does not move marker GPS positions", () => {
  assert.match(migration, /marker GPS positions intentionally unchanged/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
  assert.doesNotMatch(migration, /longitude =/u);
  assert.doesNotMatch(migration, /latitude =/u);
});

test("Section C lot 49 clip migration constrains grave slices to the lot polygon", () => {
  assert.match(clipMigration, /ST_Intersection/u);
  assert.match(clipMigration, /lot_slices\.lot_geometry/u);
  assert.match(clipMigration, /ST_CollectionExtract/u);
  assert.match(clipMigration, /clipped to the lot polygon/u);
  assert.doesNotMatch(clipMigration, /UPDATE headstones/u);
});
