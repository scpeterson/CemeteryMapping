import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/364-split-c-0420-brasses-gravesites.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);

test("C-0420 migration creates Alice's grave north of Paul's without moving the marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0420'/u);
  assert.match(migration, /'0420A', 'TLC-GPS-0420-01'/u);
  assert.match(migration, /'Alice M Brasses'/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /geometry = replacement_geometries\.south_geometry/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
});

test("C-0420 migration assigns both linked Brasses burials and shared-marker links", () => {
  assert.match(migration, /name = 'Paul John Brasses'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'paul john brasses'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'alice m brasses'/u);
  assert.match(migration, /headstone_burials\.headstone_uuid = marker_context\.headstone_uuid/u);
  assert.match(migration, /SELECT headstone_uuid, paul_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, alice_gravesite_uuid, 'spans'/u);
});

test("C-0420 migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/364-split-c-0420-brasses-gravesites\.sql/u);
});
