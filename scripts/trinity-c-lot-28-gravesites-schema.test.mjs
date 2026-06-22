import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/141-fit-c-0181-through-c-0184-into-lot-28.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("Section C lot 28 migration fits five gravesites from south to north", () => {
  assert.match(migration, /lots\.lot_id = '28'/u);
  assert.match(migration, /'TLC-GPS-0181-02', '0181B', 0/u);
  assert.match(migration, /'TLC-GPS-0181-01', '0181A', 1/u);
  assert.match(migration, /'TLC-GPS-0182', '0182', 2/u);
  assert.match(migration, /'TLC-GPS-0183', '0183', 3/u);
  assert.match(migration, /'TLC-GPS-0184', '0184', 4/u);
});

test("Section C lot 28 migration records requested north to south ordering", () => {
  assert.match(migration, /Edwin R Hieber assigned to the northernmost gravesite in lot C-28/u);
  assert.match(migration, /Bertha L Hieber assigned to the second gravesite from the north in lot C-28/u);
  assert.match(migration, /Alice A Hieber assigned to the middle gravesite in lot C-28/u);
  assert.match(migration, /Anna C Hieber assigned to the second gravesite from the south in lot C-28/u);
  assert.match(migration, /David L Hieber assigned to the southernmost gravesite in lot C-28/u);
});

test("Section C lot 28 migration clips gravesite slices to the lot polygon", () => {
  assert.match(migration, /ST_Intersection/u);
  assert.match(migration, /lot_slices\.lot_geometry/u);
  assert.match(migration, /ST_CollectionExtract/u);
  assert.match(migration, /clipped to the lot polygon/u);
});

test("Section C lot 28 migration does not move marker GPS positions", () => {
  assert.match(migration, /marker GPS positions intentionally unchanged/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
  assert.doesNotMatch(migration, /longitude =/u);
  assert.doesNotMatch(migration, /latitude =/u);
});
