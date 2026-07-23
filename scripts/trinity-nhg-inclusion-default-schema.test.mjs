import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../db/changelog/changes/243-repair-trinity-nhg-inclusion-default.sql", import.meta.url),
  "utf8",
);
const rootChangelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");
const standaloneMigration = readFileSync(
  new URL("../db/changelog/changes/244-default-standalone-trinity-markers-listed-in-nhg.sql", import.meta.url),
  "utf8",
);

test("Trinity markers default to listed without overwriting explicit exceptions", () => {
  assert.match(migration, /Trinity Lutheran Church Cemetery/u);
  assert.match(migration, /jsonb_build_object\('nhgInclusion', 'listed'\)/u);
  assert.match(migration, /NOT jsonb_exists\([\s\S]*NormalizedProvenance'[\s\S]*'nhgInclusion'/u);
});

test("Trinity NHG default migration includes primary and associated gravesites", () => {
  assert.match(migration, /headstones\.gravesite_uuid/u);
  assert.match(migration, /JOIN headstone_gravesites/u);
  assert.match(migration, /UNION/u);
});

test("Trinity NHG default migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/243-repair-trinity-nhg-inclusion-default\.sql/u);
  assert.match(rootChangelog, /changes\/244-default-standalone-trinity-markers-listed-in-nhg\.sql/u);
});

test("standalone markers inside Trinity receive the same default", () => {
  assert.match(standaloneMigration, /ST_Covers\(trinity\.geometry, headstones\.geometry\)/u);
  assert.match(standaloneMigration, /jsonb_build_object\('nhgInclusion', 'listed'\)/u);
});
