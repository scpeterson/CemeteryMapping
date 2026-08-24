import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/324-split-c-0340-knobeloch-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");
const overlapReview = fs.readFileSync(
  new URL("../db/changelog/changes/325-review-c-0340-cross-row-overlaps.sql", import.meta.url),
  "utf8",
);

test("C-0340 split keeps Karl in the original southern grave and places Clara north", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0340'/u);
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /name = 'Karl Charles Knobeloch'[\s\S]*geometry = replacement_geometries\.south_geometry/u);
  assert.match(migration, /'Clara Dorothea Knobeloch'[\s\S]*'0340A'[\s\S]*'TLC-GPS-0340-01'[\s\S]*north_geometry/u);
});

test("C-0340 split assigns both burials and spans both graves without moving the marker", () => {
  assert.match(migration, /full_name, ''\)\) = 'karl charles knobeloch'/u);
  assert.match(migration, /full_name, ''\)\) = 'clara dorothea knobeloch'/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.karl_gravesite_uuid/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry =/u);
});

test("C-0340 split asserts its sources and is included in the root changelog", () => {
  assert.match(migration, /assert_migration_prerequisite/u);
  assert.match(migration, /gravesite_id IN \('TLC-GPS-0339', 'TLC-GPS-0341'\)/u);
  assert.match(migration, /exactly one active Karl Charles Knobeloch burial and one active Clara Dorothea Knobeloch burial/u);
  assert.match(rootChangelog, /changes\/324-split-c-0340-knobeloch-gravesites\.sql/u);
});

test("C-0340 records only its three exact reviewed cross-row overlap exceptions", () => {
  assert.match(overlapReview, /count\(\*\)[\s\S]*\) IN \(0, 3\)/u);
  assert.match(overlapReview, /gravesite_id = 'TLC-GPS-0155'[\s\S]*Overlaps gravesite TLC-GPS-0340\./u);
  assert.match(overlapReview, /gravesite_id = 'TLC-GPS-0340-01'[\s\S]*Overlaps gravesite TLC-GPS-0328-01\./u);
  assert.match(overlapReview, /Overlaps gravesite TLC-GPS-0328-02\./u);
  assert.match(overlapReview, /Moving the pair would create worse same-row conflicts\./u);
  assert.match(overlapReview, /--rollback DELETE FROM reviewed_spatial_validation_exceptions/u);
  assert.match(rootChangelog, /changes\/325-review-c-0340-cross-row-overlaps\.sql/u);
});
