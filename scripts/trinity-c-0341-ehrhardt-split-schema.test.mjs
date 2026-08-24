import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/326-split-c-0341-ehrhardt-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");
const overlapReview = fs.readFileSync(
  new URL("../db/changelog/changes/327-review-c-0341-cross-row-overlaps.sql", import.meta.url),
  "utf8",
);

test("C-0341 split keeps JV in the original southern grave and places Anna north", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0341'/u);
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /name = 'JV Ehrhardt'[\s\S]*geometry = replacement_geometries\.south_geometry/u);
  assert.match(migration, /'Anna M Ehrhardt'[\s\S]*'0341A'[\s\S]*'TLC-GPS-0341-01'[\s\S]*north_geometry/u);
});

test("C-0341 split assigns both burials and spans both graves without moving the marker", () => {
  assert.match(migration, /full_name, ''\)\) = 'jv ehrhardt'/u);
  assert.match(migration, /full_name, ''\)\) = 'anna m ehrhardt'/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.jv_gravesite_uuid/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry =/u);
});

test("C-0341 split asserts its sources and is included in the root changelog", () => {
  assert.match(migration, /assert_migration_prerequisite/u);
  assert.match(migration, /gravesite_id IN \('TLC-GPS-0340', 'TLC-GPS-0342'\)/u);
  assert.match(migration, /exactly one active JV Ehrhardt burial and one active Anna M Ehrhardt burial/u);
  assert.match(rootChangelog, /changes\/326-split-c-0341-ehrhardt-gravesites\.sql/u);
});

test("C-0341 records only its six exact reviewed cross-row overlap exceptions", () => {
  assert.match(overlapReview, /count\(\*\)[\s\S]*\) IN \(0, 6\)/u);
  assert.match(overlapReview, /gravesite_id = 'TLC-GPS-0328-03'[\s\S]*Overlaps gravesite TLC-GPS-0341-01\./u);
  assert.match(overlapReview, /gravesite_id = 'TLC-GPS-0340-01'[\s\S]*Overlaps gravesite TLC-GPS-0341\./u);
  assert.match(overlapReview, /gravesite_id = 'TLC-GPS-0341'[\s\S]*TLC-GPS-0328-01\.[\s\S]*TLC-GPS-0328-02\./u);
  assert.match(overlapReview, /gravesite_id = 'TLC-GPS-0341-01'[\s\S]*TLC-GPS-0329\.[\s\S]*TLC-GPS-0329-01\./u);
  assert.match(overlapReview, /--rollback DELETE FROM reviewed_spatial_validation_exceptions/u);
  assert.match(rootChangelog, /changes\/327-review-c-0341-cross-row-overlaps\.sql/u);
});
