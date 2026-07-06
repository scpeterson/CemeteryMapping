import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/216-source-person-records.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("source person records migration stores source-only people without cemetery objects", () => {
  assert.match(migration, /CREATE TABLE source_person_records/u);
  assert.match(migration, /north_hills_ocr_entry_id uuid REFERENCES north_hills_ocr_entries\(id\) ON DELETE SET NULL/u);
  assert.match(migration, /north_hills_ocr_source_fact_id uuid REFERENCES north_hills_ocr_source_facts\(id\) ON DELETE SET NULL/u);
  assert.match(migration, /source_code IN \('CR', 'CRG', 'FH', 'SK', 'NOTE', 'OTHER'\)/u);
  assert.match(migration, /record_type IN \('death_record', 'burial_record', 'funeral_record', 'church_record', 'family_history', 'other'\)/u);
  assert.match(migration, /status IN \('unmatched', 'candidate_match', 'linked', 'rejected'\)/u);
  assert.match(migration, /birth_date_text varchar\(100\)/u);
  assert.match(migration, /death_date_text varchar\(100\)/u);
  assert.match(migration, /burial_date_text varchar\(100\)/u);
  assert.match(migration, /funeral_date_text varchar\(100\)/u);
});

test("source person record links require exactly one cemetery target", () => {
  assert.match(migration, /CREATE TABLE source_person_record_links/u);
  assert.match(migration, /burial_uuid uuid REFERENCES burials\(id\) ON DELETE CASCADE/u);
  assert.match(migration, /gravesite_uuid uuid REFERENCES gravesites\(id\) ON DELETE CASCADE/u);
  assert.match(migration, /headstone_uuid uuid REFERENCES headstones\(id\) ON DELETE CASCADE/u);
  assert.match(migration, /num_nonnulls\(burial_uuid, gravesite_uuid, headstone_uuid\) = 1/u);
  assert.match(migration, /link_type IN \('candidate', 'matched', 'rejected'\)/u);
  assert.match(migration, /CREATE UNIQUE INDEX source_person_record_links_burial_unique_idx/u);
  assert.match(migration, /WHERE burial_uuid IS NOT NULL/u);
  assert.match(migration, /CREATE UNIQUE INDEX source_person_record_links_gravesite_unique_idx/u);
  assert.match(migration, /CREATE UNIQUE INDEX source_person_record_links_headstone_unique_idx/u);
});

test("source person records are indexed and audited", () => {
  assert.match(migration, /CREATE INDEX source_person_records_cemetery_page_idx/u);
  assert.match(migration, /CREATE INDEX source_person_records_full_name_trgm_idx/u);
  assert.match(migration, /CREATE INDEX source_person_record_links_record_idx/u);
  assert.match(migration, /CREATE TRIGGER touch_source_person_records_updated_at/u);
  assert.match(migration, /CREATE TRIGGER audit_source_person_records_changes/u);
  assert.match(migration, /CREATE TRIGGER audit_source_person_record_links_changes/u);
});
