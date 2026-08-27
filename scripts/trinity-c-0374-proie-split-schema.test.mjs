import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/342-split-c-0374-proie-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("C-0374 keeps James south and creates Evelyn's grave north", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0374'/u);
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /name = 'James A Proie'[\s\S]*geometry = replacement_geometries\.south_geometry/u);
  assert.match(migration, /'Evelyn C Proie'[\s\S]*'0374A'[\s\S]*'TLC-GPS-0374-01'[\s\S]*north_geometry/u);
  assert.match(migration, /slightly overlaps mapped C-0373[\s\S]*verify boundaries in the field/u);
});

test("C-0374 corrects Evelyn's surname and assigns both burials", () => {
  assert.match(migration, /first_name, ''\)\) = 'james a'/u);
  assert.match(migration, /first_name, ''\)\) = 'evelyn c'/u);
  assert.match(migration, /last_name = 'Proie'/u);
  assert.match(migration, /full_name = 'Evelyn C Proie'/u);
  assert.match(migration, /gravesite_id = 'TLC-GPS-0374-01'/u);
});

test("TLC-HS-0374 spans both graves without moving the marker", () => {
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.james_gravesite_uuid/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
});

test("C-0374 split is safe without DEV source records and is registered", () => {
  assert.match(migration, /NOT EXISTS \([\s\S]*gravesite_id = 'TLC-GPS-0374'/u);
  assert.match(migration, /gravesite_id IN \('TLC-GPS-0373', 'TLC-GPS-0375'\)/u);
  assert.match(rootChangelog, /changes\/342-split-c-0374-proie-gravesites\.sql/u);
});
