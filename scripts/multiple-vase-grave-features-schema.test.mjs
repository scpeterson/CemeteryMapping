import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/303-multiple-vase-grave-features.sql", import.meta.url),
  "utf8",
);
const featureSchema = fs.readFileSync(
  new URL("../db/changelog/changes/119-grave-feature-lookups.sql", import.meta.url),
  "utf8",
);
const detailPanel = fs.readFileSync(new URL("../src/components/DetailPanel.tsx", import.meta.url), "utf8");
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("vases can be recorded as repeatable marker features", () => {
  assert.match(migration, /'vase'/u);
  assert.match(migration, /'Vase'/u);
  assert.match(migration, /Record each vase as a separate feature/u);
  assert.match(featureSchema, /headstone_uuid uuid REFERENCES headstones\(id\)/u);
  assert.doesNotMatch(featureSchema, /UNIQUE\s*\(\s*headstone_uuid\s*,\s*feature_type_id/u);
  assert.match(detailPanel, /<GraveFeatureForm headstones=\{\[headstone\]\} fixedHeadstone=\{headstone\}/u);
});

test("multiple-vase feature migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/303-multiple-vase-grave-features\.sql/u);
});
