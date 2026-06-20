import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/124-repair-c-0190-kempf-anna-scope.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("C-0190 Kempf repair restores same-name Anna records linked to another marker", () => {
  assert.match(migration, /TLC-HS-0190/u);
  assert.match(migration, /non_c_0190_marker\.headstone_id <> 'TLC-HS-0190'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'anna kempf'/u);
  assert.match(migration, /correct_gravesite\.gravesite_id AS correct_gravesite_id/u);
  assert.match(migration, /gravesite_id = misassigned_anna_records\.correct_gravesite_id/u);
});

test("C-0190 Kempf repair removes the accidental C-0190 marker-burial link", () => {
  assert.match(migration, /UPDATE headstone_burials/u);
  assert.match(migration, /headstone_burials\.headstone_uuid = c_0190_marker\.id/u);
  assert.match(migration, /deleted_at = now\(\)/u);
  assert.match(migration, /Repair C-0190 split so Anna Kempf records linked to another marker remain with that marker/u);
});
