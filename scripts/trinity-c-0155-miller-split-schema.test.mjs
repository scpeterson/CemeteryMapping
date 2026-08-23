import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { derivedGravesiteStatusSql } from "../server/gravesiteStatusSql.mjs";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/323-split-c-0155-miller-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("C-0155 split keeps Susanne in the original northern grave and creates an unoccupied southern grave", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0155'/u);
  assert.match(migration, /headstone_point AS shared_west_corner/u);
  assert.match(migration, /name = 'Susanne R Miller'[\s\S]*geometry = replacement_geometries\.north_geometry/u);
  assert.match(migration, /NULL,[\s\S]*'0155A',[\s\S]*'TLC-GPS-0155-01'[\s\S]*south_geometry/u);
  assert.match(migration, /code = 'sold'/u);
  assert.match(migration, /Sold, unoccupied southern gravesite C-0155A/u);
  assert.doesNotMatch(migration, /INSERT INTO burials/u);
});

test("C-0155 split keeps the marker fixed and spans both gravesites", () => {
  assert.match(migration, /relationship_type = 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.susanne_gravesite_uuid/u);
  assert.match(migration, /headstone_burials\.headstone_uuid = marker_context\.headstone_uuid/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry =/u);
});

test("C-0155 split supports clean rebuilds while asserting operational source data", () => {
  assert.match(migration, /assert_migration_prerequisite/u);
  assert.match(migration, /gravesite_id IN \('TLC-GPS-0154', 'TLC-GPS-0156'\)/u);
  assert.match(migration, /exactly one active Susanne R Miller burial must exist/u);
  assert.match(rootChangelog, /changes\/323-split-c-0155-miller-gravesites\.sql/u);
});

test("the shared map status derivation preserves an explicit sold status", () => {
  const statusSql = derivedGravesiteStatusSql();
  assert.match(statusSql, /status_type\.code = 'sold'/u);
  assert.ok(statusSql.indexOf("THEN 'occupied'") < statusSql.indexOf("status_type.code = 'sold'"));
  assert.ok(statusSql.indexOf("status_type.code = 'sold'") < statusSql.indexOf("THEN 'available'"));
});
