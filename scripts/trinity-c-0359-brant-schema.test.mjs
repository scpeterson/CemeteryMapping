import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/338-split-c-0359-brant-gravesites.sql", import.meta.url),
  "utf8",
);
const linkRepair = fs.readFileSync(
  new URL("../db/changelog/changes/339-link-c-0359-bette-brandt-headstone.sql", import.meta.url),
  "utf8",
);
const provenanceCorrection = fs.readFileSync(
  new URL("../db/changelog/changes/340-correct-c-0359-burial-nhg-provenance.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);

test("C-0359 migration creates two graves north of Eleanor without moving the marker", () => {
  assert.match(migration, /--validCheckSum 9:612fb0ed5c506c3e4a27c0c06e9a50b2/u);
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0359'/u);
  assert.match(migration, /'0359A', 'TLC-GPS-0359-01'/u);
  assert.match(migration, /'0359B', 'TLC-GPS-0359-02'/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 8 \* 0\.3048, 0\)/u);
  assert.match(migration, /ST_Project\(headstone_point::geography, 4 \* 0\.3048, pi\(\)\)/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*(?:longitude|latitude)\s*=/u);
});

test("C-0359 migration assigns all three burials and shared-marker links", () => {
  assert.match(migration, /name = 'Eleanor Brant'/u);
  assert.match(migration, /'Elmer H Brant'/u);
  assert.match(migration, /'Bette C Brandt'/u);
  assert.match(migration, /INSERT INTO burials/u);
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, bette_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SET gravesite_uuid = marker_context\.eleanor_gravesite_uuid/u);
  assert.match(migration, /SET gravesite_uuid = marker_context\.elmer_gravesite_uuid/u);
  assert.match(migration, /SET gravesite_uuid = marker_context\.bette_gravesite_uuid/u);
  assert.match(linkRepair, /INSERT INTO headstone_burials/u);
  assert.match(linkRepair, /'bette c brandt'/u);
});

test("C-0359 migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/338-split-c-0359-brant-gravesites\.sql/u);
  assert.match(changelog, /changes\/339-link-c-0359-bette-brandt-headstone\.sql/u);
  assert.match(changelog, /changes\/340-correct-c-0359-burial-nhg-provenance\.sql/u);
});

test("C-0359 provenance correction records mixed NHG inclusion and fixes Bette's surname", () => {
  assert.match(provenanceCorrection, /--validCheckSum 9:b222cae2dcc3cdffe10a31efe0b5391b/u);
  assert.match(provenanceCorrection, /NOT EXISTS \([\s\S]*gravesite_id = 'TLC-GPS-0359'/u);
  assert.match(provenanceCorrection, /THEN 'not_listed'/u);
  assert.match(provenanceCorrection, /ELSE 'listed'/u);
  assert.match(provenanceCorrection, /'nhgInclusion'/u);
  assert.match(provenanceCorrection, /last_name = CASE[\s\S]*THEN 'Brant'/u);
  assert.match(provenanceCorrection, /THEN 'Bette C Brant'/u);
  assert.match(provenanceCorrection, /name = 'Bette C Brant'/u);
});
