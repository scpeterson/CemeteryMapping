import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/095-create-trinity-a-lots-9-through-1.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("Section A lots 9 through 1 sit directly above lots 30 through 38", () => {
  assert.match(migration, /INSERT INTO lots/u);
  assert.match(migration, /WHEN '30' THEN '9'/u);
  assert.match(migration, /WHEN '38' THEN '1'/u);
  assert.match(migration, /lots\.lot_id IN \('30', '31', '32', '33', '34', '35', '36', '37', '38'\)/u);
  assert.match(migration, /'A-' \|\| lot_id/u);
  assert.match(migration, /ST_XMin\(Box2D\(anchor_lots\.geometry\)\)/u);
  assert.match(migration, /ST_XMax\(Box2D\(anchor_lots\.geometry\)\)/u);
  assert.match(migration, /ST_YMax\(Box2D\(anchor_lots\.geometry\)\),/u);
  assert.match(
    migration,
    /ST_YMax\(Box2D\(anchor_lots\.geometry\)\) \+ \(ST_YMax\(Box2D\(anchor_lots\.geometry\)\) - ST_YMin\(Box2D\(anchor_lots\.geometry\)\)\)/u,
  );
  assert.match(migration, /10\.00/u);
  assert.match(migration, /20\.00/u);
  assert.doesNotMatch(migration, /UPDATE gravesites/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
});
