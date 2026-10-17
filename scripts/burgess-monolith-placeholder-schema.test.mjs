import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../db/changelog/changes/365-retire-a-0017-burgess-monolith-placeholder.sql", import.meta.url),
  "utf8",
);
const rootChangelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("Burgess cleanup retires only the generated A-0017 grave and pseudo-burial", () => {
  assert.match(migration, /gravesite_id = 'TLC-GPS-0017'/u);
  assert.match(migration, /headstone_id = 'TLC-HS-0017'/u);
  assert.match(migration, /marker_scope_types\.code = 'monolith'/u);
  assert.match(migration, /lower\(trim\(COALESCE\(.*full_name, ''\)\)\) = 'burgess monolith'/u);
  assert.match(migration, /UPDATE burials[\s\S]*deleted_at = now\(\)/u);
  assert.match(migration, /UPDATE gravesites[\s\S]*deleted_at = now\(\)/u);
  assert.doesNotMatch(migration, /DELETE FROM/u);
});

test("Burgess cleanup keeps the monument and its photos independent of A-0017", () => {
  assert.match(migration, /UPDATE headstones[\s\S]*gravesite_uuid = NULL/u);
  assert.match(migration, /photos remain linked directly to TLC-HS-0017/u);
  assert.match(migration, /updated_marker AS \([\s\S]*SET gravesite_uuid = NULL, updated_at = now\(\)[\s\S]*RETURNING headstones\.id/u);
  assert.doesNotMatch(migration, /UPDATE headstone_media_assets[\s\S]*deleted_at = now\(\)/u);
});

test("Burgess monolith cleanup is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/365-retire-a-0017-burgess-monolith-placeholder\.sql/u);
});
