import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/093-create-trinity-a-lots-52-through-60.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("Section A lots 52 through 60 sit directly above lots 69 through 61", () => {
  assert.match(migration, /INSERT INTO lots/u);
  assert.match(migration, /WHEN '69' THEN '52'/u);
  assert.match(migration, /WHEN '61' THEN '60'/u);
  assert.match(migration, /lots\.lot_id IN \('69', '68', '67', '66', '65', '64', '63', '62', '61'\)/u);
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
