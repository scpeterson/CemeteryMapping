import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/104-import-trinity-missing-shapefile-markers.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("missing shapefile marker import uses shapefile point geometry and imports linked burials", () => {
  assert.match(migration, /ST_MakePoint\(source_markers\.longitude::double precision, source_markers\.latitude::double precision\)/u);
  assert.match(migration, /'CoordinateSource', 'shapefile geometry'/u);
  assert.match(migration, /INSERT INTO headstone_burials/u);
  assert.match(migration, /Person column: '/u);

  for (const markerId of [
    "TLC-HS-0559",
    "TLC-HS-0560",
    "TLC-HS-0561",
    "TLC-HS-0562",
    "TLC-HS-0563",
    "TLC-HS-0564",
    "TLC-HS-0565",
    "TLC-HS-0566",
    "TLC-HS-0567",
    "TLC-HS-0568",
    "TLC-HS-0569",
    "TLC-HS-0570",
    "TLC-HS-0571",
    "TLC-HS-0572",
    "TLC-HS-0573",
  ]) {
    assert.match(migration, new RegExp(`'${markerId}'`, "u"));
  }
});

test("missing shapefile marker import preserves all six possible person source columns", () => {
  for (const personNumber of [1, 2, 3, 4, 5, 6]) {
    assert.match(migration, new RegExp(`'Person${personNumber}First'`, "u"));
    assert.match(migration, new RegExp(`'Person${personNumber}Last'`, "u"));
    assert.match(migration, new RegExp(`'Person${personNumber}DOB'`, "u"));
    assert.match(migration, new RegExp(`'Person${personNumber}DOD'`, "u"));
  }
});
