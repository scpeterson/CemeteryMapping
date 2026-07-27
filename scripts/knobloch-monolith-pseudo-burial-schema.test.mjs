import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../db/changelog/changes/264-remove-knobloch-monolith-pseudo-burial.sql", import.meta.url),
  "utf8",
);
const gravesiteMigration = readFileSync(
  new URL("../db/changelog/changes/265-retire-knobloch-monolith-placeholder-gravesite.sql", import.meta.url),
  "utf8",
);
const rootChangelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("Knobloch cleanup soft-deletes only the monolith pseudo-burial and its direct marker link", () => {
  assert.match(migration, /gravesites\.gravesite_id = 'TLC-GPS-0284'/u);
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0284'/u);
  assert.match(migration, /lower\(trim\(COALESCE\(burials\.full_name, ''\)\)\) = 'knobloch monolith'/u);
  assert.match(migration, /UPDATE headstone_burials[\s\S]*deleted_at = now\(\)/u);
  assert.match(migration, /UPDATE burials[\s\S]*deleted_at = now\(\)/u);
  assert.doesNotMatch(migration, /DELETE FROM (?:burials|gravesites|headstones)/u);
  assert.doesNotMatch(migration, /UPDATE (?:gravesites|headstones)\s+SET/iu);
});

test("Knobloch pseudo-burial cleanup migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/264-remove-knobloch-monolith-pseudo-burial\.sql/u);
});

test("Knobloch cleanup links the monolith to the three real gravesites and retires only C-0284", () => {
  assert.match(gravesiteMigration, /'TLC-GPS-0282', 'TLC-GPS-0283', 'TLC-GPS-0285'/u);
  assert.match(gravesiteMigration, /'spans'/u);
  assert.match(gravesiteMigration, /gravesite_uuid = \([\s\S]*gravesite_id = 'TLC-GPS-0283'/u);
  assert.match(gravesiteMigration, /gravesites\.gravesite_id = 'TLC-GPS-0284'/u);
  assert.match(gravesiteMigration, /C-0284 represented the Knobloch monolith position, not a physical gravesite/u);
  assert.doesNotMatch(gravesiteMigration, /UPDATE headstones\s+SET\s+deleted_at = now\(\)/u);
  assert.match(rootChangelog, /changes\/265-retire-knobloch-monolith-placeholder-gravesite\.sql/u);
});
