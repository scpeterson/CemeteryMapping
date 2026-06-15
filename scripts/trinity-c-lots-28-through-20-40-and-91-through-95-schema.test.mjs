import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL(
  "../db/changelog/changes/088-create-trinity-c-lots-28-through-20-40-and-91-through-95.sql",
  import.meta.url,
);
const migration = readFileSync(migrationPath, "utf8");

test("Section C lots west of lot 29 follow the historic numbering sequence", () => {
  assert.match(migration, /INSERT INTO lots/u);
  assert.match(migration, /lots\.lot_id = '29'/u);
  assert.match(migration, /lots\.lot_id = '10'/u);
  assert.match(migration, /\(1, '28'\)/u);
  assert.match(migration, /\(9, '20'\)/u);
  assert.match(migration, /\(10, '40'\)/u);
  assert.match(migration, /\(11, '91'\)/u);
  assert.match(migration, /\(12, '92'\)/u);
  assert.match(migration, /\(15, '95'\)/u);
  assert.match(migration, /'C-' \|\| lot_id/u);
  assert.match(migration, /10\.00/u);
  assert.match(migration, /20\.00/u);
  assert.match(migration, /ST_YMin\(Box2D\(lot_10\.geometry\)\) >= ST_YMax\(Box2D\(lot_29\.geometry\)\) - 0\.000001/u);
  assert.match(migration, /anchor_grid\.lot_29_west_longitude - anchor_grid\.lot_width_longitude \* lot_sequence\.westward_offset/u);
  assert.doesNotMatch(migration, /UPDATE gravesites/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
});
