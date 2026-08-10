import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/301-split-c-0432-muller-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("Muller migration splits TLC-GPS-0432 around the fixed shared marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0432'/u);
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /'0432A', 'TLC-GPS-0432-01'/u);
  assert.match(migration, /gravesite_id = 'TLC-GPS-0432-01'/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /SET gravesite_uuid = marker_context\.mabel_gravesite_uuid/u);
});

test("Muller split migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/301-split-c-0432-muller-gravesites\.sql/u);
});
