import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/335-consolidate-vandevort-military-plaque-burial.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");
const reviewMigration = fs.readFileSync(
  new URL("../db/changelog/changes/336-review-c-0428-and-unlink-military-plaque.sql", import.meta.url),
  "utf8",
);

test("TLC-HS-0428 is reassigned to canonical C-0427 David Lynn Vandevort", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0428'/u);
  assert.match(migration, /full_name, ''\)\) = 'david lynn vandevort'[\s\S]*gravesite_id = 'TLC-GPS-0427'/u);
  assert.match(migration, /INSERT INTO headstone_burials/u);
  assert.match(migration, /record_context\.plaque_uuid, updated_canonical_burial\.id/u);
});

test("canonical burial preserves the plaque's military branch and rank", () => {
  assert.match(migration, /military_branch_type_id = COALESCE\(burials\.military_branch_type_id, record_context\.duplicate_branch_type_id\)/u);
  assert.match(migration, /military_rank_type_id = COALESCE\(burials\.military_rank_type_id, record_context\.duplicate_rank_type_id\)/u);
  assert.match(migration, /military_war_service_type_id = COALESCE/u);
  assert.doesNotMatch(migration, /death_date\s*=/u);
});

test("duplicate C-0428 burial and obsolete plaque link are soft-deleted", () => {
  assert.match(migration, /full_name, ''\)\) = 'david l vandevort'[\s\S]*gravesite_id = 'TLC-GPS-0428'/u);
  assert.match(migration, /UPDATE headstone_burials[\s\S]*deleted_at = now\(\)/u);
  assert.match(migration, /UPDATE burials[\s\S]*deleted_at = now\(\)/u);
  assert.doesNotMatch(migration, /DELETE FROM/u);
});

test("plaque and C-0428 gravesite remain active and migration is registered", () => {
  assert.doesNotMatch(migration, /UPDATE (?:headstones|gravesites)[\s\S]*deleted_at = now\(\)/u);
  assert.match(rootChangelog, /changes\/335-consolidate-vandevort-military-plaque-burial\.sql/u);
});

test("C-0428 needs review and is no longer associated with TLC-HS-0428", () => {
  assert.match(reviewMigration, /headstones[\s\S]*gravesite_uuid = NULL/u);
  assert.match(reviewMigration, /UPDATE headstone_gravesites[\s\S]*deleted_at = now\(\)/u);
  assert.match(reviewMigration, /needs_review_status\.code = 'needs_review'/u);
  assert.doesNotMatch(reviewMigration, /UPDATE headstone_burials/u);
  assert.doesNotMatch(reviewMigration, /UPDATE gravesites[\s\S]*deleted_at = now\(\)/u);
  assert.match(rootChangelog, /changes\/336-review-c-0428-and-unlink-military-plaque\.sql/u);
});
