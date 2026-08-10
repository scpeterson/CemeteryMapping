import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/302-memorial-plaque-grave-feature.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("memorial plaques are available as grave features with a veteran plaque subtype", () => {
  assert.match(migration, /'memorial_plaque'/u);
  assert.match(migration, /'Memorial plaque'/u);
  assert.match(migration, /'government_veteran_plaque'/u);
  assert.match(migration, /'Government-issued veteran plaque'/u);
  assert.match(migration, /grave_feature_types\.code = 'memorial_plaque'/u);
  assert.match(migration, /ON CONFLICT \(code\) DO UPDATE/u);
});

test("memorial plaque migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/302-memorial-plaque-grave-feature\.sql/u);
});
