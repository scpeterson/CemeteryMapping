import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/140-fit-c-0202-through-c-0205-into-lot-27.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("Section C lot 27 migration fits five gravesites from south to north", () => {
  assert.match(migration, /lots\.lot_id = '27'/u);
  assert.match(migration, /'TLC-GPS-0202', '0202', 0/u);
  assert.match(migration, /'TLC-GPS-0203', '0203', 1/u);
  assert.match(migration, /'TLC-GPS-0204', '0204', 2/u);
  assert.match(migration, /'TLC-GPS-0205-02', '0205B', 3/u);
  assert.match(migration, /'TLC-GPS-0205-01', '0205A', 4/u);
});

test("Section C lot 27 migration records requested north to south ordering", () => {
  assert.match(migration, /Elizabeth Wills Broerman assigned to the northernmost gravesite in lot C-27/u);
  assert.match(migration, /Frank Wills assigned to the second gravesite from the north in lot C-27/u);
  assert.match(migration, /Frank E Wills assigned to the middle gravesite in lot C-27/u);
  assert.match(migration, /John H Wills assigned to the second gravesite from the south in lot C-27/u);
  assert.match(migration, /John G Wiskeman assigned to the southernmost gravesite in lot C-27/u);
});

test("Section C lot 27 migration clips gravesite slices to the lot polygon", () => {
  assert.match(migration, /ST_Intersection/u);
  assert.match(migration, /lot_slices\.lot_geometry/u);
  assert.match(migration, /ST_CollectionExtract/u);
  assert.match(migration, /clipped to the lot polygon/u);
});

test("Section C lot 27 migration does not move marker GPS positions", () => {
  assert.match(migration, /marker GPS positions intentionally unchanged/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
  assert.doesNotMatch(migration, /longitude =/u);
  assert.doesNotMatch(migration, /latitude =/u);
});
