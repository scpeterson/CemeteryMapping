import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../db/changelog/changes/241-normalize-c-0161-survey-provenance.sql", import.meta.url),
  "utf8",
);
const rootChangelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("C-0161 provenance distinguishes cemetery section from NHG inclusion", () => {
  assert.match(migration, /'cemeterySection', 'C'/u);
  assert.match(migration, /'nhgInclusion', 'not_listed'/u);
  assert.match(migration, /'markerGeometrySourceType', 'field_survey'/u);
  assert.match(migration, /'verificationStatus', 'verified'/u);
});

test("C-0161 provenance removes false NHG coordinates from both Soergel burials", () => {
  assert.match(migration, /North Hills Genealogists section: C/u);
  assert.match(migration, /'c jean soergel'/u);
  assert.match(migration, /'warren a soergel'/u);
  assert.match(migration, /Not listed in the North Hills Genealogists book/u);
});

test("C-0161 provenance migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/241-normalize-c-0161-survey-provenance\.sql/u);
});
