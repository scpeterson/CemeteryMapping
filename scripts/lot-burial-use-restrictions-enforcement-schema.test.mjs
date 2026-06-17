import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/103-enforce-lot-burial-use-restrictions.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("lot burial use restriction enforcement blocks gravesites in prohibited lots and areas", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION enforce_lot_burial_use_restrictions/u);
  assert.match(migration, /selected_lot\.burial_use_status = 'non_burial'/u);
  assert.match(migration, /Lot %-?% cannot contain gravesites or markers/u);
  assert.match(migration, /FROM lot_restricted_areas/u);
  assert.match(migration, /ST_Intersects\(NEW\.geometry, lot_restricted_areas\.geometry\)/u);
  assert.match(migration, /ST_Area\(ST_Intersection\(NEW\.geometry, lot_restricted_areas\.geometry\)\) > 0/u);
  assert.match(migration, /BEFORE INSERT OR UPDATE OF lot_uuid, geometry, deleted_at ON gravesites/u);
  assert.match(migration, /gravesites_lot_burial_use_restrictions_check/u);
});
