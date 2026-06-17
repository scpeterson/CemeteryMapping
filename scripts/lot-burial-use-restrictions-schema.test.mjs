import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/101-lot-burial-use-restrictions.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("lot burial use restriction migration marks whole non-burial lots and A-62 partial area", () => {
  assert.match(migration, /ADD COLUMN burial_use_status varchar\(40\) NOT NULL DEFAULT 'standard'/u);
  assert.match(migration, /CREATE TABLE lot_restricted_areas/u);
  assert.match(migration, /geometry geometry\(MultiPolygon, 4326\) NOT NULL/u);
  assert.match(migration, /audit_lot_restricted_areas_changes/u);

  for (const lotId of ["84", "85", "90", "95", "100"]) {
    assert.match(migration, new RegExp(`'${lotId}'`, "u"));
  }
  assert.match(migration, /upper\(COALESCE\(lots\.section_id, ''\)\) = 'A' AND lots\.lot_id = '61'/u);
  assert.match(migration, /burial_use_status = 'non_burial'/u);
  assert.match(migration, /burial_use_status = 'partially_restricted'/u);
  assert.match(migration, /lots\.lot_id = '62'/u);
  assert.match(migration, /\* 0\.4/u);
  assert.match(migration, /'A-62 southern 2\/5'/u);
  assert.match(migration, /'no_gravesites_or_markers'/u);
});
