import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/106-update-trinity-marker-points-from-shapefile.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("marker shapefile geometry update moves reviewed marker points only", () => {
  assert.match(migration, /UPDATE headstones/u);
  assert.match(migration, /ST_MakePoint\(reviewed_updates\.longitude::double precision, reviewed_updates\.latitude::double precision\)/u);
  assert.match(migration, /'coordinateSource', 'shapefile geometry'/u);
  assert.match(migration, /'previousLongitude', ST_X\(headstones\.geometry\)/u);
  assert.doesNotMatch(migration, /UPDATE gravesites/u);
});

test("marker shapefile geometry update includes manually reviewed exception markers", () => {
  for (const markerId of ["TLC-HS-0038", "TLC-HS-0045", "TLC-HS-0062"]) {
    assert.match(migration, new RegExp(`'${markerId}'`, "u"));
  }
});

test("marker shapefile geometry update contains the reviewed marker set", () => {
  const uniqueMarkers = new Set([...migration.matchAll(/'TLC-HS-[0-9]+'/gu)].map((match) => match[0]));
  assert.equal(uniqueMarkers.size, 551);
});
