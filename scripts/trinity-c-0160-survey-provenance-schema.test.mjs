import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/237-normalize-c-0160-survey-provenance.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");
const changelogPath = new URL("../db/changelog/db.changelog-root.yaml", import.meta.url);
const changelog = readFileSync(changelogPath, "utf8");

test("TLC-HS-0160 distinguishes cemetery location from NHG provenance", () => {
  assert.match(migration, /'cemeterySection', 'C'/u);
  assert.match(migration, /'nhgInclusion', 'not_listed'/u);
  assert.match(migration, /Not listed in the North Hills Genealogists book/u);
  assert.match(migration, /North Hills Genealogists row: 0/u);
  assert.match(migration, /Trinity Lutheran Church section: NA/u);
});

test("TLC-HS-0160 records verified survey provenance without changing geometry", () => {
  assert.match(migration, /'markerGeometrySourceType', 'field_survey'/u);
  assert.match(migration, /'markerGeometrySource', 'TrinityCemeteryFinal3\.shp'/u);
  assert.match(migration, /'verificationStatus', 'verified'/u);
  assert.match(migration, /data_confidence = 'high'/u);
  assert.match(migration, /review_status = 'reviewed'/u);
  assert.doesNotMatch(migration, /SET[\s\S]*geometry\s*=/u);
});

test("TLC-HS-0160 provenance cleanup is scoped through marker burial links", () => {
  assert.match(migration, /headstone_id = 'TLC-HS-0160'/u);
  assert.match(migration, /JOIN headstone_burials/u);
  assert.match(migration, /'clair r "bill" wiskeman'/u);
  assert.match(migration, /'martha j wiskeman'/u);
});

test("TLC-HS-0160 survey provenance migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/237-normalize-c-0160-survey-provenance\.sql/u);
});
