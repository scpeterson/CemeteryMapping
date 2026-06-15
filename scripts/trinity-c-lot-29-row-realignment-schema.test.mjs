import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/089-realign-trinity-c-lot-29-row.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("Section C lot 29 row realignment uses lot 51 as the grid anchor", () => {
  assert.match(migration, /INSERT INTO lots/u);
  assert.match(migration, /lots\.lot_id = '51'/u);
  assert.match(migration, /\(0, '29'\)/u);
  assert.match(migration, /\(9, '20'\)/u);
  assert.match(migration, /\(10, '40'\)/u);
  assert.match(migration, /\(11, '91'\)/u);
  assert.match(migration, /\(12, '92'\)/u);
  assert.match(migration, /\(15, '95'\)/u);
  assert.match(migration, /ST_XMin\(Box2D\(lot_51\.geometry\)\) AS lot_29_west_longitude/u);
  assert.match(migration, /ST_XMax\(Box2D\(lot_51\.geometry\)\) AS lot_29_east_longitude/u);
  assert.match(
    migration,
    /ST_YMax\(Box2D\(lot_51\.geometry\)\) \+ \(\(ST_YMax\(Box2D\(lot_51\.geometry\)\) - ST_YMin\(Box2D\(lot_51\.geometry\)\)\) \/ 2\) AS south_latitude/u,
  );
  assert.match(migration, /anchor_grid\.lot_29_west_longitude - anchor_grid\.lot_width_longitude \* lot_sequence\.westward_offset/u);
  assert.match(migration, /10\.00/u);
  assert.match(migration, /20\.00/u);
  assert.doesNotMatch(migration, /UPDATE gravesites/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
});
