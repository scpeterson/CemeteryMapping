import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/100-shift-selected-lot-rows-west.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("selected lot row shift moves the C-100, C-95, A-9, and A-30 rows west only", () => {
  assert.match(migration, /UPDATE lots/u);
  assert.match(migration, /UPDATE gravesites/u);
  assert.match(migration, /lots\.block_id IS NULL/u);
  assert.match(migration, /upper\(COALESCE\(lots\.section_id, ''\)\) = 'C'/u);
  assert.match(migration, /upper\(COALESCE\(lots\.section_id, ''\)\) = 'A'/u);
  assert.match(migration, /'100'/u);
  assert.match(migration, /'95'/u);
  assert.match(migration, /'9'/u);
  assert.match(migration, /'30'/u);
  assert.match(migration, /ST_Transform\(lots\.geometry, 2272\)/u);
  assert.match(migration, /ST_Transform\(gravesites\.geometry, 2272\)/u);
  assert.match(migration, /gravesites\.lot_uuid = target_lots\.id/u);
  assert.match(migration, /\n\s*-1\.5,\n\s*0\n/u);
  assert.match(migration, /::geometry\(MultiPolygon, 4326\)/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
  assert.doesNotMatch(migration, /UPDATE sections/u);
});
