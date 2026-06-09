import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/060-create-trinity-c-lot-70.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("Section C lot 70 migration creates a reviewed lot from the five Soergel gravesites", () => {
  assert.match(migration, /INSERT INTO lots/u);
  assert.match(migration, /'C-70'/u);
  assert.match(migration, /'70'/u);
  assert.match(migration, /ST_UnaryUnion\(ST_Collect\(geometry\)\)/u);
  assert.match(migration, /HAVING count\(\*\) = 5/u);
  assert.match(migration, /UPDATE gravesites/u);
  assert.match(migration, /TLC-GPS-0168/u);
  assert.match(migration, /TLC-GPS-0167-01/u);
  assert.match(migration, /TLC-GPS-0167-02/u);
  assert.match(migration, /TLC-GPS-0166-01/u);
  assert.match(migration, /TLC-GPS-0166-02/u);
});
