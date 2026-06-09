import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/061-create-trinity-c-lot-51.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("Section C lot 51 migration creates the missing available gravesite and reviewed lot", () => {
  assert.match(migration, /INSERT INTO gravesites/u);
  assert.match(migration, /'Available gravesite in Section C lot 51'/u);
  assert.match(migration, /'0168A'/u);
  assert.match(migration, /'TLC-LOT-51-0168A'/u);
  assert.match(migration, /updated_existing_gravesites/u);
  assert.match(migration, /UPDATE headstones/u);
  assert.match(migration, /lot_uuid = upserted_lot\.id/u);
  assert.match(migration, /ST_YMax\(Box2D\(c_0168\.geometry\)\)/u);
  assert.match(migration, /ST_YMax\(Box2D\(c_0169\.geometry\)\) - ST_YMin\(Box2D\(c_0169\.geometry\)\)/u);
  assert.match(migration, /INSERT INTO lots/u);
  assert.match(migration, /'C-51'/u);
  assert.match(migration, /'51'/u);
  assert.match(migration, /ST_UnaryUnion\(ST_Collect\(geometry\)\)/u);
  assert.match(migration, /HAVING count\(\*\) = 5/u);
  assert.match(migration, /TLC-GPS-0171-01/u);
  assert.match(migration, /TLC-GPS-0171-02/u);
  assert.match(migration, /TLC-GPS-0170/u);
  assert.match(migration, /TLC-GPS-0169/u);
});
