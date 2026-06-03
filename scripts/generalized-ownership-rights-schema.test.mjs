import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/041-generalized-ownership-rights.sql", import.meta.url);

test("generalized ownership rights migration supports lot, gravesite, section, and unlocated rights", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /CREATE TABLE ownership_parties/u);
  assert.match(migration, /CREATE TABLE ownership_events/u);
  assert.match(migration, /CREATE TABLE ownership_event_parties/u);
  assert.match(migration, /CREATE TABLE ownership_event_rights/u);
  assert.match(migration, /target_type IN \('lot', 'gravesite', 'section', 'unlocated'\)/u);
  assert.match(migration, /target_type = 'gravesite'[\s\S]*gravesite_uuid IS NOT NULL/u);
  assert.match(migration, /target_type = 'lot'[\s\S]*lot_uuid IS NOT NULL/u);
  assert.match(migration, /CREATE OR REPLACE FUNCTION sync_ownership_event_right_cemetery/u);
  assert.match(migration, /does not match target cemetery/u);
  assert.match(migration, /does not match event cemetery/u);
  assert.match(migration, /legacy_lot_ownership_event_uuid/u);
  assert.match(migration, /CREATE VIEW current_ownership_right_owners/u);
});
