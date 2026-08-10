import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/305-split-c-0329-knobeloch-torres-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("Knobeloch/Torres migration splits TLC-GPS-0329 around the fixed shared marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0329'/u);
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /'0329A', 'TLC-GPS-0329-01'/u);
  assert.match(migration, /'Kimberly A', 'Torres', 'Kimberly A Torres'/u);
  assert.match(migration, /'medium', 'needs_review'/u);
  assert.match(migration, /WHERE NOT EXISTS \(SELECT 1 FROM updated_kimberly_burial\)/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /SET gravesite_uuid = marker_context\.judith_gravesite_uuid/u);
});

test("C-0329 Knobeloch/Torres split migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/305-split-c-0329-knobeloch-torres-gravesites\.sql/u);
});
