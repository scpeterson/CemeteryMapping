import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/102-add-trinity-a-front-row-burial-use-restrictions.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("Section A lots 5 through 8 are marked as non-burial lots", () => {
  assert.match(migration, /burial_use_status = 'non_burial'/u);
  assert.match(migration, /upper\(COALESCE\(lots\.section_id, ''\)\) = 'A'/u);
  assert.match(migration, /lots\.lot_id IN \('5', '6', '7', '8'\)/u);
  assert.match(migration, /cannot contain gravesites or markers/u);
});
