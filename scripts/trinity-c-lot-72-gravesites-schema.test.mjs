import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/222-fit-c-0192-through-c-0194-into-lot-72.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");
const changelogPath = new URL("../db/changelog/db.changelog-root.yaml", import.meta.url);
const changelog = readFileSync(changelogPath, "utf8");

test("Section C lot 72 migration positions top and bottom grave pairs", () => {
  assert.match(migration, /lots\.lot_id = '72'/u);
  assert.match(migration, /'TLC-GPS-0192-02', '0192B', 0/u);
  assert.match(migration, /'TLC-GPS-0192-01', '0192A', 1/u);
  assert.match(migration, /'TLC-GPS-0193', '0193', 3/u);
  assert.match(migration, /'TLC-GPS-0194', '0194', 4/u);
});

test("Section C lot 72 migration derives clipped gravesite slices from the lot polygon", () => {
  assert.match(migration, /north_latitude - south_latitude\) \/ 5/u);
  assert.match(migration, /ST_MakeEnvelope/u);
  assert.match(migration, /ST_Intersection/u);
  assert.match(migration, /ST_CollectionExtract/u);
  assert.match(migration, /clipped to the lot polygon/u);
});

test("Section C lot 72 migration keeps marker GPS positions unchanged", () => {
  assert.match(migration, /marker GPS positions intentionally unchanged/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
  assert.doesNotMatch(migration, /longitude =/u);
  assert.doesNotMatch(migration, /latitude =/u);
});

test("Section C lot 72 migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/222-fit-c-0192-through-c-0194-into-lot-72\.sql/u);
});
