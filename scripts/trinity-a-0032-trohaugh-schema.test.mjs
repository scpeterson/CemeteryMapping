import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/380-split-a-0032-trohaugh-gravesites.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);
const overlapReview = fs.readFileSync(
  new URL("../db/changelog/changes/381-review-a-0032-neighbor-overlaps.sql", import.meta.url),
  "utf8",
);

test("A-0032 migration splits the two Trohaugh burials around the fixed marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0032'/u);
  assert.match(migration, /name = 'Frank T Trohaugh'/u);
  assert.match(migration, /'0032A', 'TLC-GPS-0032-01'/u);
  assert.match(migration, /'Ruth R Trohaugh'/u);
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*(?:longitude|latitude)\s*=/u);
});

test("A-0032 migration assigns each existing burial to its own gravesite", () => {
  assert.match(migration, /gravesite_uuid = marker_context\.frank_gravesite_uuid/u);
  assert.match(migration, /gravesite_id = 'TLC-GPS-0032'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.ruth_gravesite_uuid/u);
  assert.match(migration, /gravesite_id = 'TLC-GPS-0032-01'/u);
});

test("A-0032 migration is included after migration 379", () => {
  assert.match(
    changelog,
    /changes\/379-primary-photos\.sql[\s\S]*changes\/380-split-a-0032-trohaugh-gravesites\.sql/u,
  );
});

test("A-0032 records only its three exact reviewed neighboring overlaps", () => {
  assert.match(overlapReview, /IN \(0, 3\)/u);
  assert.doesNotMatch(overlapReview, /TLC-GPS-0031-01/u);
  assert.match(overlapReview, /TLC-GPS-0033/u);
  assert.match(overlapReview, /TLC-GPS-0040/u);
  assert.match(overlapReview, /reviewed_by[\s\S]*'migration-381'/u);
  assert.match(changelog, /changes\/381-review-a-0032-neighbor-overlaps\.sql/u);
});
