import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL(
  "../db/changelog/changes/091-create-trinity-c-lots-11-through-19-39-and-96-through-100.sql",
  import.meta.url,
);
const migration = readFileSync(migrationPath, "utf8");

test("Section C lots west of lot 10 follow the historic numbering sequence", () => {
  assert.match(migration, /INSERT INTO lots/u);
  assert.match(migration, /lots\.lot_id = '10'/u);
  assert.match(migration, /lots\.lot_id = '29'/u);
  assert.match(migration, /\(1, '11'\)/u);
  assert.match(migration, /\(9, '19'\)/u);
  assert.match(migration, /\(10, '39'\)/u);
  assert.match(migration, /\(11, '96'\)/u);
  assert.match(migration, /\(15, '100'\)/u);
  assert.match(migration, /'C-' \|\| lot_id/u);
  assert.match(migration, /10\.00/u);
  assert.match(migration, /20\.00/u);
  assert.match(migration, /ST_XMin\(Box2D\(lot_29\.geometry\)\) = ST_XMin\(Box2D\(lot_10\.geometry\)\)/u);
  assert.match(migration, /ST_XMax\(Box2D\(lot_29\.geometry\)\) = ST_XMax\(Box2D\(lot_10\.geometry\)\)/u);
  assert.match(migration, /ST_YMax\(Box2D\(lot_29\.geometry\)\) = ST_YMin\(Box2D\(lot_10\.geometry\)\)/u);
  assert.match(migration, /anchor_grid\.lot_10_west_longitude - anchor_grid\.lot_width_longitude \* lot_sequence\.westward_offset/u);
  assert.doesNotMatch(migration, /UPDATE gravesites/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
});
