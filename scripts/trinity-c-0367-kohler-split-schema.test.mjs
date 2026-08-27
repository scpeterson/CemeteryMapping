import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/341-split-c-0367-kohler-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("C-0367 preserves Edmund's geometry and creates Marie's grave north", () => {
  const edmundUpdate = migration.match(/edmund_gravesite AS \([\s\S]*?FROM replacement_geometries/u)?.[0] ?? "";
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0367'/u);
  assert.match(migration, /ST_YMax\(ST_Envelope\(gravesites\.geometry\)\)/u);
  assert.match(edmundUpdate, /name = 'Edmund Kohler'/u);
  assert.doesNotMatch(edmundUpdate, /\bgeometry\s*=/u);
  assert.match(migration, /'Marie Kohler'[\s\S]*'0367A'[\s\S]*'TLC-GPS-0367-01'[\s\S]*marie_geometry/u);
});

test("C-0367 assigns both burials and spans both graves without moving the marker", () => {
  assert.match(migration, /full_name, ''\)\) = 'edmund kohler'/u);
  assert.match(migration, /full_name, ''\)\) = 'marie kohler'/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.edmund_gravesite_uuid/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
});

test("C-0367 split is safe without DEV source records and is registered", () => {
  assert.match(migration, /NOT EXISTS \([\s\S]*gravesite_id = 'TLC-GPS-0367'/u);
  assert.match(migration, /gravesite_id IN \('TLC-GPS-0366', 'TLC-GPS-0368'\)/u);
  assert.match(rootChangelog, /changes\/341-split-c-0367-kohler-gravesites\.sql/u);
});
