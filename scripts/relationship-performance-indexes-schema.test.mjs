import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/157-add-relationship-performance-indexes.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("relationship performance migration indexes active UUID relationships", () => {
  assert.match(migration, /CREATE INDEX IF NOT EXISTS burials_gravesite_uuid_active_idx/u);
  assert.match(migration, /ON burials \(gravesite_uuid\)\s+WHERE deleted_at IS NULL/u);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS owners_gravesite_uuid_active_idx/u);
  assert.match(migration, /ON owners \(gravesite_uuid\)\s+WHERE deleted_at IS NULL/u);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS lots_cemetery_id_active_idx/u);
  assert.match(migration, /ON lots \(cemetery_id\)\s+WHERE deleted_at IS NULL/u);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS gravesites_lot_uuid_active_idx/u);
  assert.match(migration, /ON gravesites \(lot_uuid\)\s+WHERE deleted_at IS NULL/u);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS headstones_gravesite_uuid_active_idx/u);
  assert.match(migration, /ON headstones \(gravesite_uuid\)\s+WHERE deleted_at IS NULL/u);
});
