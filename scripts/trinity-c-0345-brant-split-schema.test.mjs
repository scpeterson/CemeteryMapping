import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/330-split-c-0345-brant-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");
const overlapReview = fs.readFileSync(
  new URL("../db/changelog/changes/331-review-c-0345-neighbor-overlap.sql", import.meta.url),
  "utf8",
);

test("C-0345 split keeps Herbert in the original southern grave and places Helen north", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0345'/u);
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /name = 'Herbert George Brant'[\s\S]*geometry = replacement_geometries\.south_geometry/u);
  assert.match(migration, /'Helen S Brant'[\s\S]*'0345A'[\s\S]*'TLC-GPS-0345-01'[\s\S]*north_geometry/u);
});

test("C-0345 split assigns both burials and spans both graves without moving the marker", () => {
  assert.match(migration, /full_name, ''\)\) = 'herbert george brant'/u);
  assert.match(migration, /full_name, ''\)\) = 'helen s brant'/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.herbert_gravesite_uuid/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry =/u);
});

test("C-0345 split asserts its sources and is included in the root changelog", () => {
  assert.match(migration, /assert_migration_prerequisite/u);
  assert.match(migration, /gravesite_id IN \('TLC-GPS-0344', 'TLC-GPS-0346'\)/u);
  assert.match(migration, /exactly one active Herbert George Brant burial and one active Helen S Brant burial/u);
  assert.match(rootChangelog, /changes\/330-split-c-0345-brant-gravesites\.sql/u);
});

test("C-0345 records only its one exact reviewed neighboring overlap exception", () => {
  assert.match(overlapReview, /count\(\*\)[\s\S]*\) IN \(0, 1\)/u);
  assert.match(overlapReview, /gravesite_id = 'TLC-GPS-0345-01'/u);
  assert.match(overlapReview, /issue_detail = 'Overlaps gravesite TLC-GPS-0346\.'/u);
  assert.match(overlapReview, /estimated neighboring C-0346 polygon/u);
  assert.match(overlapReview, /--rollback DELETE FROM reviewed_spatial_validation_exceptions/u);
  assert.match(rootChangelog, /changes\/331-review-c-0345-neighbor-overlap\.sql/u);
});
