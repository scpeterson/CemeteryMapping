import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/321-split-c-0338-hague-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");
const overlapReview = fs.readFileSync(
  new URL("../db/changelog/changes/322-review-c-0338-cross-row-overlaps.sql", import.meta.url),
  "utf8",
);

test("C-0338 Hague split keeps Arthur in the original grave and places Isabelle north", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0338'/u);
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /name = 'Arthur Julius Hague'[\s\S]*geometry = replacement_geometries\.south_geometry/u);
  assert.match(migration, /'Isabelle M Hague'[\s\S]*'0338A'[\s\S]*'TLC-GPS-0338-01'[\s\S]*north_geometry/u);
});

test("C-0338 Hague split assigns each burial and spans both gravesites without moving the marker", () => {
  assert.match(migration, /full_name, ''\)\) = 'arthur julius hague'/u);
  assert.match(migration, /full_name, ''\)\) = 'isabelle m hague'/u);
  assert.match(migration, /headstone_burials\.headstone_uuid = marker_context\.headstone_uuid/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.arthur_gravesite_uuid/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry =/u);
});

test("C-0338 Hague split asserts its source records and is included in the root changelog", () => {
  assert.match(migration, /assert_migration_prerequisite/u);
  assert.match(migration, /exactly one active Arthur Julius Hague burial and one active Isabelle M Hague burial/u);
  assert.match(rootChangelog, /changes\/321-split-c-0338-hague-gravesites\.sql/u);
});

test("C-0338 records only its exact reviewed cross-row overlap exceptions", () => {
  assert.match(overlapReview, /count\(\*\)[\s\S]*\) = 3/u);
  assert.match(overlapReview, /gravesite_id = 'TLC-GPS-0338-01'/u);
  assert.match(overlapReview, /issue_detail = 'Overlaps gravesite TLC-GPS-0338-01\.'/u);
  assert.match(overlapReview, /Southward offsets create larger same-row conflicts\./u);
  assert.match(overlapReview, /--rollback DELETE FROM reviewed_spatial_validation_exceptions/u);
  assert.match(rootChangelog, /changes\/322-review-c-0338-cross-row-overlaps\.sql/u);
});
