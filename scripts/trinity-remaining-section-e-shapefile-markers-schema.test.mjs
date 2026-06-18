import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/108-import-remaining-trinity-section-e-shapefile-markers.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");
const linkMigrationPath = new URL("../db/changelog/changes/109-link-remaining-trinity-section-e-shapefile-markers.sql", import.meta.url);
const linkMigration = readFileSync(linkMigrationPath, "utf8");

test("remaining Section E shapefile marker import brings in Heinrich Brant and Conrad Brand", () => {
  for (const expected of [
    "TLC-HS-0574",
    "TLC-HS-0575",
    "TLC-GPS-0574",
    "TLC-GPS-0575",
    "Heinrich",
    "Brant",
    "Conrad",
    "Brand",
  ]) {
    assert.match(migration, new RegExp(`'${expected}'`, "u"));
  }

  assert.match(migration, /297, '299'/u);
  assert.match(migration, /299, '301'/u);
  assert.match(migration, /'CoordinateSource', 'shapefile geometry'/u);
  assert.match(migration, /'ShapefileGeometryUpdate'/u);
});

test("remaining Section E shapefile marker import creates linked operational gravesites", () => {
  assert.match(migration, /ST_MakePoint\(source_markers\.longitude::double precision, source_markers\.latitude::double precision\)/u);
  assert.match(migration, /Generated as a 4 ft x 10 ft operational gravesite/u);
  assert.match(migration, /INSERT INTO headstone_gravesites/u);
  assert.match(migration, /INSERT INTO headstone_burials/u);
});

test("remaining Section E shapefile marker link repair attaches gravesites and burials", () => {
  assert.match(linkMigration, /UPDATE headstones/u);
  assert.match(linkMigration, /INSERT INTO headstone_gravesites/u);
  assert.match(linkMigration, /INSERT INTO burials/u);
  assert.match(linkMigration, /WHERE NOT EXISTS/u);

  for (const expected of ["TLC-HS-0574", "TLC-HS-0575", "TLC-GPS-0574", "TLC-GPS-0575"]) {
    assert.match(linkMigration, new RegExp(`'${expected}'`, "u"));
  }
});
