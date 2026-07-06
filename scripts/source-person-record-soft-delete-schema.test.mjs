import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/217-source-person-record-soft-delete.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("source person records support audited soft deletes", () => {
  assert.match(migration, /ALTER TABLE source_person_records/u);
  assert.match(migration, /ADD COLUMN deleted_at timestamptz/u);
  assert.match(migration, /ADD COLUMN deleted_by uuid REFERENCES app_users\(id\) ON DELETE SET NULL/u);
  assert.match(migration, /ADD COLUMN delete_reason text/u);
});

test("source person record links support audited soft deletes", () => {
  assert.match(migration, /ALTER TABLE source_person_record_links/u);
  assert.match(migration, /ADD COLUMN deleted_at timestamptz/u);
  assert.match(migration, /ADD COLUMN deleted_by uuid REFERENCES app_users\(id\) ON DELETE SET NULL/u);
  assert.match(migration, /ADD COLUMN delete_reason text/u);
});

test("source person active indexes ignore soft-deleted rows", () => {
  assert.match(migration, /CREATE INDEX source_person_records_active_idx/u);
  assert.match(migration, /WHERE deleted_at IS NULL/u);
  assert.match(migration, /CREATE INDEX source_person_record_links_active_record_idx/u);
  assert.match(migration, /WHERE deleted_at IS NULL/u);
});
