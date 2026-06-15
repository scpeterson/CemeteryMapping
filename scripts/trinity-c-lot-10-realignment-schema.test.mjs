import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/090-realign-trinity-c-lot-10.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("Section C lot 10 realignment sits directly above corrected lot 29", () => {
  assert.match(migration, /INSERT INTO lots/u);
  assert.match(migration, /lots\.lot_id = '29'/u);
  assert.match(migration, /'C-10'/u);
  assert.match(migration, /'10'/u);
  assert.match(migration, /ST_XMin\(Box2D\(lot_29\.geometry\)\)/u);
  assert.match(migration, /ST_XMax\(Box2D\(lot_29\.geometry\)\)/u);
  assert.match(migration, /ST_YMax\(Box2D\(lot_29\.geometry\)\),/u);
  assert.match(migration, /ST_YMax\(Box2D\(lot_29\.geometry\)\) \+ \(ST_YMax\(Box2D\(lot_29\.geometry\)\) - ST_YMin\(Box2D\(lot_29\.geometry\)\)\)/u);
  assert.match(migration, /10\.00/u);
  assert.match(migration, /20\.00/u);
  assert.doesNotMatch(migration, /UPDATE gravesites/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
});
