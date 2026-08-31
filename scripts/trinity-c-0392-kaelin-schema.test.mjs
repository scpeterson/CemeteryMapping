import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/350-split-c-0392-kaelin-gravesites.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);
const placementCorrection = fs.readFileSync(
  new URL("../db/changelog/changes/351-place-c-0392-kaelin-graves-north-of-c-0359.sql", import.meta.url),
  "utf8",
);
const referenceCorrection = fs.readFileSync(
  new URL("../db/changelog/changes/352-place-c-0392a-north-of-c-0392.sql", import.meta.url),
  "utf8",
);

test("C-0392 migration creates Elizabeth's grave north and moves Elmer's grave south without moving the marker", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0392'/u);
  assert.match(migration, /'0392A', 'TLC-GPS-0392-01'/u);
  assert.match(migration, /'Elizabeth A Kaelin'/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.match(migration, /cost, north_geometry/u);
  assert.match(migration, /geometry = replacement_geometries\.south_geometry/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*(?:longitude|latitude)\s*=/u);
});

test("C-0392 migration assigns both Kaelin burials and shared-marker links", () => {
  assert.match(migration, /name = 'Elmer B Kaelin'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'elmer b kaelin'/u);
  assert.match(migration, /lower\(COALESCE\(burials\.full_name, ''\)\) = 'elizabeth a kaelin'/u);
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0392'/u);
  assert.match(migration, /headstone_burials\.headstone_uuid = marker_context\.headstone_uuid/u);
  assert.match(migration, /SET gravesite_uuid = marker_context\.elmer_gravesite_uuid/u);
  assert.match(migration, /SET gravesite_uuid = marker_context\.elizabeth_gravesite_uuid/u);
  assert.match(migration, /SELECT headstone_uuid, elmer_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, elizabeth_gravesite_uuid, 'spans'/u);
  assert.match(migration, /INSERT INTO headstone_burials/u);
});

test("C-0392 migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/350-split-c-0392-kaelin-gravesites\.sql/u);
  assert.match(changelog, /changes\/351-place-c-0392-kaelin-graves-north-of-c-0359\.sql/u);
  assert.match(changelog, /changes\/352-place-c-0392a-north-of-c-0392\.sql/u);
});

test("final Kaelin placement puts both graves north of C-0359 without moving TLC-HS-0392", () => {
  assert.match(placementCorrection, /gravesite_id = 'TLC-GPS-0359'/u);
  assert.match(placementCorrection, /ST_YMax\(Box2D\(geometry\)\)/u);
  assert.match(placementCorrection, /4 \* 0\.3048, 0/u);
  assert.match(placementCorrection, /8 \* 0\.3048, 0/u);
  assert.match(placementCorrection, /gravesites\.gravesite_id = 'TLC-GPS-0392'/u);
  assert.match(placementCorrection, /gravesites\.gravesite_id = 'TLC-GPS-0392-01'/u);
  assert.doesNotMatch(placementCorrection, /UPDATE headstones/u);
});

test("reference correction places C-0392A immediately north of C-0392 without moving the marker", () => {
  assert.match(referenceCorrection, /NOT EXISTS \([\s\S]*gravesite_id = 'TLC-GPS-0392'/u);
  assert.match(referenceCorrection, /headstone_id = 'TLC-HS-0392'/u);
  assert.match(referenceCorrection, /4 \* 0\.3048, 0/u);
  assert.match(referenceCorrection, /4 \* 0\.3048, pi\(\)/u);
  assert.match(referenceCorrection, /gravesites\.gravesite_id = 'TLC-GPS-0392'/u);
  assert.match(referenceCorrection, /gravesites\.gravesite_id = 'TLC-GPS-0392-01'/u);
  assert.doesNotMatch(referenceCorrection, /UPDATE headstones/u);
});
