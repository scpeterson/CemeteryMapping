import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/059-historic-lot-map-evidence.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("historic lot map migration stages reviewable evidence without mutating gravesites", () => {
  assert.match(migration, /CREATE TABLE historic_lot_map_gravesite_evidence/u);
  assert.match(migration, /observed_gravesite_label varchar\(100\) NOT NULL/u);
  assert.match(migration, /relationship_type IN \('lot', 'passageway_between_lots'/u);
  assert.match(migration, /'C-0168', NULL, '70', 'lot'/u);
  assert.match(migration, /'C-0166A', 'C-0166', '70', 'lot'/u);
  assert.match(migration, /'C-0171B', NULL, '51', 'lot'/u);
  assert.match(migration, /'C-0172A', NULL, NULL, 'passageway_between_lots', ARRAY\['29', '51'\]::text\[\]/u);
  assert.match(migration, /The original C-0166 gravesite was created from the Geo-locations spreadsheet/u);
  assert.match(migration, /A later field photo shows one shared headstone for both gravesites/u);
  assert.match(migration, /James H\. Simpson died in 1995 and appears in NHG, while Ruth F\. Simpson died in 2011/u);
  assert.doesNotMatch(migration, /UPDATE\s+gravesites/iu);
});
