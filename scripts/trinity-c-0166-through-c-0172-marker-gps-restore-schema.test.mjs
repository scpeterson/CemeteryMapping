import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/097-restore-c-0166-through-c-0172-marker-gps-points.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("Section C marker restore uses imported spreadsheet GPS points only for C-0166 through C-0172", () => {
  assert.match(migration, /source_properties ->> 'Longitude'/u);
  assert.match(migration, /source_properties ->> 'Latitude'/u);
  assert.match(migration, /ST_SetSRID\(ST_MakePoint\(imported_marker_points\.imported_longitude, imported_marker_points\.imported_latitude\), 4326\)/u);

  for (const markerId of ["0166", "0167", "0168", "0169", "0170", "0171", "0172"]) {
    assert.match(migration, new RegExp(`'TLC-HS-${markerId}'`, "u"));
  }

  assert.doesNotMatch(migration, /TLC-HS-0173/u);
  assert.doesNotMatch(migration, /TLC-HS-0174/u);
});
