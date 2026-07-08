import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/223-split-c-0180-wiskeman-gravesites.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");
const changelogPath = new URL("../db/changelog/db.changelog-root.yaml", import.meta.url);
const changelog = readFileSync(changelogPath, "utf8");

test("C-0180 Wiskeman split assigns Mary north and John south", () => {
  assert.match(migration, /TLC-HS-0180/u);
  assert.match(migration, /TLC-GPS-0180-01/u);
  assert.match(migration, /TLC-GPS-0180-02/u);
  assert.match(migration, /Mary "May" Wiskeman/u);
  assert.match(migration, /'0180A'/u);
  assert.match(migration, /north_geometry/u);
  assert.match(migration, /John "Jack" Wiskeman/u);
  assert.match(migration, /'0180B'/u);
  assert.match(migration, /south_geometry/u);
});

test("C-0180 Wiskeman split keeps marker fixed and spans both gravesites", () => {
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /headstones\.id = marker_context\.headstone_uuid/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*longitude =/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*latitude =/u);
});

test("C-0180 Wiskeman split moves each burial to the intended grave", () => {
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'john "jack" wiskeman'/u);
  assert.match(migration, /gravesite_id = 'TLC-GPS-0180-02'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'mary "may" wiskeman'/u);
  assert.match(migration, /gravesite_id = 'TLC-GPS-0180-01'/u);
});

test("C-0180 Wiskeman split migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/223-split-c-0180-wiskeman-gravesites\.sql/u);
});
