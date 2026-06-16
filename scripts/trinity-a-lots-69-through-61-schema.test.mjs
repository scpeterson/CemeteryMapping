import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/092-create-trinity-a-lots-69-through-61.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("Section A lots 69 through 61 start 12 feet east of Section C lot 70", () => {
  assert.match(migration, /INSERT INTO lots/u);
  assert.match(migration, /lots\.lot_id = '70'/u);
  assert.match(migration, /upper\(COALESCE\(lots\.section_id, ''\)\) = 'C'/u);
  assert.match(migration, /sections\.cemetery_id = c_70\.cemetery_id/u);
  assert.match(migration, /sections\.facility_id = c_70\.facility_id/u);
  assert.match(migration, /sections\.name = 'A'/u);
  assert.match(migration, /\(0, '69'\)/u);
  assert.match(migration, /\(8, '61'\)/u);
  assert.match(migration, /'A-' \|\| lot_id/u);
  assert.match(migration, /anchor_grid\.c_70_east_longitude \+ anchor_grid\.lot_width_longitude \* 1\.2/u);
  assert.match(migration, /anchor_grid\.south_latitude/u);
  assert.match(migration, /anchor_grid\.north_latitude/u);
  assert.match(migration, /10\.00/u);
  assert.match(migration, /20\.00/u);
  assert.doesNotMatch(migration, /UPDATE gravesites/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
});
