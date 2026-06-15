import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/086-create-trinity-c-lots-72-through-85.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("Section C lots 72 through 85 continue the southern row west of lot 71", () => {
  assert.match(migration, /INSERT INTO lots/u);
  assert.match(migration, /lots\.lot_id = '71'/u);
  assert.match(migration, /lots\.lot_id = '51'/u);
  assert.match(migration, /generate_series\(72, 85\)/u);
  assert.match(migration, /'C-' \|\| lot_number::text/u);
  assert.match(migration, /10\.00/u);
  assert.match(migration, /20\.00/u);
  assert.match(migration, /ST_XMin\(Box2D\(lot_51\.geometry\)\) = ST_XMax\(Box2D\(lot_71\.geometry\)\)/u);
  assert.match(migration, /ST_YMin\(Box2D\(lot_51\.geometry\)\) = ST_YMax\(Box2D\(lot_71\.geometry\)\)/u);
  assert.match(migration, /anchor_grid\.lot_71_west_longitude - anchor_grid\.lot_width_longitude \* \(generated_lots\.lot_number - 71\)/u);
  assert.doesNotMatch(migration, /UPDATE gravesites/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
});
