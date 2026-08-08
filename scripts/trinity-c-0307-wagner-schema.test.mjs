import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/294-split-c-0307-wagner-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("Wagner migration splits C-0307 around the fixed shared marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0307'/u);
  assert.match(migration, /'0307A', 'TLC-GPS-0307-01'/u);
  assert.match(migration, /AS north_geometry/u);
  assert.match(migration, /AS south_geometry/u);
  assert.match(migration, /name = 'Anthony Wagner'/u);
  assert.match(migration, /'Helen Wagner'/u);
  assert.match(migration, /normalized_given_name = 'anthony'/u);
  assert.match(migration, /normalized_given_name = 'helen'/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /SET gravesite_uuid = marker_context\.anthony_gravesite_uuid/u);
});

test("Wagner split migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/294-split-c-0307-wagner-gravesites\.sql/u);
});
