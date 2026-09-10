import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/382-split-a-0004-kaelin-gravesites.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);
const overlapReview = fs.readFileSync(
  new URL("../db/changelog/changes/383-review-a-0004-neighbor-overlaps.sql", import.meta.url),
  "utf8",
);
const reciprocalOverlapReview = fs.readFileSync(
  new URL("../db/changelog/changes/384-review-a-0021-kaelin-overlaps.sql", import.meta.url),
  "utf8",
);

test("A-0004 migration splits the Kaelin records around the fixed marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0004'/u);
  assert.match(migration, /name = 'Donald N Kaelin'/u);
  assert.match(migration, /'0004A', 'TLC-GPS-0004-01'/u);
  assert.match(migration, /'Ellen M Kaelin'/u);
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*(?:longitude|latitude)\s*=/u);
});

test("A-0004 assigns Donald as interred and Ellen as pre-need in separate gravesites", () => {
  assert.match(migration, /gravesite_uuid = marker_context\.donald_gravesite_uuid/u);
  assert.match(migration, /gravesite_id = 'TLC-GPS-0004'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.ellen_gravesite_uuid/u);
  assert.match(migration, /gravesite_id = 'TLC-GPS-0004-01'/u);
  assert.match(migration, /code = 'pre_need_inscription'/u);
  assert.match(migration, /code = 'sold'/u);
  assert.match(migration, /burial_date = NULL/u);
});

test("A-0004 migration follows the current changelog", () => {
  assert.match(
    changelog,
    /changes\/381-review-a-0032-neighbor-overlaps\.sql[\s\S]*changes\/382-split-a-0004-kaelin-gravesites\.sql/u,
  );
});

test("A-0004 records only its two exact reviewed A-0005 overlaps", () => {
  assert.match(overlapReview, /IN \(0, 2\)/u);
  assert.match(overlapReview, /gravesite_id IN \('TLC-GPS-0004', 'TLC-GPS-0004-01'\)/u);
  assert.match(overlapReview, /Overlaps gravesite TLC-GPS-0005\./u);
  assert.match(overlapReview, /reviewed_by[\s\S]*'migration-383'/u);
  assert.match(changelog, /changes\/383-review-a-0004-neighbor-overlaps\.sql/u);
});

test("A-0004 records the two reciprocal reviewed A-0021 overlaps", () => {
  assert.match(reciprocalOverlapReview, /IN \(0, 2\)/u);
  assert.match(reciprocalOverlapReview, /gravesite_id = 'TLC-GPS-0021'/u);
  assert.match(reciprocalOverlapReview, /Overlaps gravesite TLC-GPS-0004\./u);
  assert.match(reciprocalOverlapReview, /Overlaps gravesite TLC-GPS-0004-01\./u);
  assert.match(reciprocalOverlapReview, /reviewed_by[\s\S]*'migration-384'/u);
  assert.match(changelog, /changes\/384-review-a-0021-kaelin-overlaps\.sql/u);
});
