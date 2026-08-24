import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/328-split-c-0342-brant-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");
const overlapReview = fs.readFileSync(
  new URL("../db/changelog/changes/329-review-c-0342-cross-row-overlap.sql", import.meta.url),
  "utf8",
);

test("C-0342 split keeps Edward in the original southern grave and places Sophia north", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0342'/u);
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /name = 'Edward A Brant'[\s\S]*geometry = replacement_geometries\.south_geometry/u);
  assert.match(migration, /'Sophia M Brant'[\s\S]*'0342A'[\s\S]*'TLC-GPS-0342-01'[\s\S]*north_geometry/u);
});

test("C-0342 split assigns both burials and spans both graves without moving the marker", () => {
  assert.match(migration, /full_name, ''\)\) = 'edward a brant'/u);
  assert.match(migration, /full_name, ''\)\) = 'sophia m brant'/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.edward_gravesite_uuid/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry =/u);
});

test("C-0342 split asserts its sources and is included in the root changelog", () => {
  assert.match(migration, /assert_migration_prerequisite/u);
  assert.match(migration, /gravesite_id IN \('TLC-GPS-0341', 'TLC-GPS-0343'\)/u);
  assert.match(migration, /exactly one active Edward A Brant burial and one active Sophia M Brant burial/u);
  assert.match(rootChangelog, /changes\/328-split-c-0342-brant-gravesites\.sql/u);
});

test("C-0342 records only its one exact reviewed cross-row overlap exception", () => {
  assert.match(overlapReview, /count\(\*\)[\s\S]*\) IN \(0, 1\)/u);
  assert.match(overlapReview, /gravesite_id = 'TLC-GPS-0343'/u);
  assert.match(overlapReview, /issue_detail = 'Overlaps gravesite TLC-GPS-0342-01\.'/u);
  assert.match(overlapReview, /estimated neighboring C-0343 polygon/u);
  assert.match(overlapReview, /--rollback DELETE FROM reviewed_spatial_validation_exceptions/u);
  assert.match(rootChangelog, /changes\/329-review-c-0342-cross-row-overlap\.sql/u);
});
