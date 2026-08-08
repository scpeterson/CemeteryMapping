import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/295-split-c-0311-king-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");
const nameCorrection = fs.readFileSync(
  new URL("../db/changelog/changes/296-correct-c-0311-william-king-name.sql", import.meta.url),
  "utf8",
);

test("King migration preserves C-0311 and stacks four family gravesites north", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0311'/u);
  assert.match(migration, /ST_YMax\(Box2D\(gravesites\.geometry\)\) AS south_latitude/u);
  assert.match(migration, /'Elizabeth King', '0311A', 'TLC-GPS-0311-01', 0/u);
  assert.match(migration, /'Lorena King', '0311B', 'TLC-GPS-0311-02', 1/u);
  assert.match(migration, /'Coretta King', '0311C', 'TLC-GPS-0311-03', 2/u);
  assert.match(migration, /'Anna King', '0311D', 'TLC-GPS-0311-04', 3/u);
  assert.match(migration, /full_name = 'William F King'/u);
  assert.match(migration, /full_name = 'Elizabeth King'/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /SET gravesite_uuid = marker_context\.william_gravesite_uuid/u);
  assert.doesNotMatch(migration, /UPDATE gravesites\s+SET[\s\S]*gravesites\.gravesite_id = 'TLC-GPS-0311'/u);
});

test("King split migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/295-split-c-0311-king-gravesites\.sql/u);
  assert.match(rootChangelog, /changes\/296-correct-c-0311-william-king-name\.sql/u);
  assert.match(nameCorrection, /SET name = 'William F King'/u);
});
