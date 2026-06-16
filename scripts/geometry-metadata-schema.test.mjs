import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/096-geometry-metadata.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("geometry metadata migration adds constrained lot and gravesite fields", () => {
  assert.match(migration, /ALTER TABLE lots/u);
  assert.match(migration, /ADD COLUMN geometry_type varchar\(30\) NOT NULL DEFAULT 'operational'/u);
  assert.match(migration, /ADD COLUMN geometry_source varchar\(255\)/u);
  assert.match(migration, /ADD COLUMN geometry_confidence varchar\(30\) NOT NULL DEFAULT 'estimated'/u);
  assert.match(migration, /ADD COLUMN geometry_notes text/u);
  assert.match(migration, /lots_geometry_type_check CHECK \(geometry_type IN \('evidence', 'operational', 'schematic'\)\)/u);
  assert.match(migration, /lots_geometry_confidence_check CHECK \(geometry_confidence IN \('gps', 'surveyed', 'reviewed', 'estimated', 'draft', 'unknown'\)\)/u);

  assert.match(migration, /ALTER TABLE gravesites/u);
  assert.match(migration, /gravesites_geometry_type_check CHECK \(geometry_type IN \('evidence', 'operational', 'schematic'\)\)/u);
  assert.match(migration, /gravesites_geometry_confidence_check CHECK \(geometry_confidence IN \('gps', 'surveyed', 'reviewed', 'estimated', 'draft', 'unknown'\)\)/u);
});

test("geometry metadata migration labels schematic Section A and C lot grids without moving markers", () => {
  assert.match(migration, /upper\(COALESCE\(section_id, ''\)\) = 'C'/u);
  assert.match(migration, /upper\(COALESCE\(section_id, ''\)\) = 'A'/u);
  assert.match(migration, /geometry_type = 'schematic'/u);
  assert.match(migration, /geometry_confidence = 'reviewed'/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
  assert.doesNotMatch(migration, /ST_SetSRID\(ST_MakePoint/u);
});
