import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/218-import-source-only-people.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("source-only people import inserts into source person records", () => {
  assert.match(migration, /INSERT INTO source_person_records/u);
  assert.match(migration, /source_label,\s+source_location_text/u);
  assert.match(migration, /NHG source-only church record/u);
  assert.match(migration, /NHG church records with no matching tombstone, pages 233-236/u);
});

test("source-only people import preserves church record source codes", () => {
  assert.match(migration, /\$nhg\$Baier, Heinrich\$nhg\$, 'CRG'/u);
  assert.match(migration, /\$nhg\$Baklarz, Lillian\$nhg\$, 'CR'/u);
  assert.match(migration, /\$nhg\$Übersax, Johann Jacob\$nhg\$, 'CRG'/u);
});

test("source-only people import is idempotent and rollbackable", () => {
  assert.match(migration, /WHERE NOT EXISTS/u);
  assert.match(migration, /existing\.full_name = records\.full_name/u);
  assert.match(migration, /existing\.raw_text = records\.raw_text/u);
  assert.match(migration, /--rollback .*DELETE FROM source_person_records/u);
});
