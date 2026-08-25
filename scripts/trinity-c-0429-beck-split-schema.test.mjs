import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/337-split-c-0429-beck-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("C-0429 split keeps George south and creates Lorraine's sold grave north", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0429'/u);
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /name = 'George W Beck'[\s\S]*geometry = replacement_geometries\.south_geometry/u);
  assert.match(migration, /'Lorraine L Beck'[\s\S]*'0429A'[\s\S]*'TLC-GPS-0429-01'[\s\S]*north_geometry/u);
  assert.match(migration, /gravesite_status_types WHERE code = 'sold'/u);
});

test("Lorraine is a pre-need inscription while George remains interred", () => {
  assert.match(migration, /full_name, ''\)\) = 'george w beck'[\s\S]*code = 'interred'/u);
  assert.match(migration, /full_name, ''\)\) = 'lorraine l beck'[\s\S]*code = 'pre_need_inscription'/u);
  assert.match(migration, /burial_date = NULL/u);
});

test("TLC-HS-0429 spans both graves without moving its point", () => {
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.george_gravesite_uuid/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry =/u);
});

test("C-0429 split asserts sources and is registered", () => {
  assert.match(migration, /assert_migration_prerequisite/u);
  assert.match(migration, /gravesite_id IN \('TLC-GPS-0428', 'TLC-GPS-0430'\)/u);
  assert.match(rootChangelog, /changes\/337-split-c-0429-beck-gravesites\.sql/u);
});
