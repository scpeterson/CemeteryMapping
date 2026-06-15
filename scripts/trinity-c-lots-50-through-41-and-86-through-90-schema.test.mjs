import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL(
  "../db/changelog/changes/087-create-trinity-c-lots-50-through-41-and-86-through-90.sql",
  import.meta.url,
);
const migration = readFileSync(migrationPath, "utf8");

test("Section C lots west of lot 51 follow the historic numbering sequence", () => {
  assert.match(migration, /INSERT INTO lots/u);
  assert.match(migration, /lots\.lot_id = '51'/u);
  assert.match(migration, /lots\.lot_id = '70'/u);
  assert.match(migration, /\(1, '50'\)/u);
  assert.match(migration, /\(10, '41'\)/u);
  assert.match(migration, /\(11, '86'\)/u);
  assert.match(migration, /\(15, '90'\)/u);
  assert.match(migration, /'C-' \|\| lot_id/u);
  assert.match(migration, /10\.00/u);
  assert.match(migration, /20\.00/u);
  assert.match(migration, /ST_XMin\(Box2D\(lot_70\.geometry\)\) = ST_XMin\(Box2D\(lot_51\.geometry\)\)/u);
  assert.match(migration, /ST_XMax\(Box2D\(lot_70\.geometry\)\) = ST_XMax\(Box2D\(lot_51\.geometry\)\)/u);
  assert.match(migration, /ST_YMax\(Box2D\(lot_70\.geometry\)\) = ST_YMin\(Box2D\(lot_51\.geometry\)\)/u);
  assert.match(migration, /anchor_grid\.lot_51_west_longitude - anchor_grid\.lot_width_longitude \* lot_sequence\.westward_offset/u);
  assert.doesNotMatch(migration, /UPDATE gravesites/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
});
