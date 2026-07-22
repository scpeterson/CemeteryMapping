import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/239-verified-places-and-burial-death-location.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");
const changelogPath = new URL("../db/changelog/db.changelog-root.yaml", import.meta.url);
const changelog = readFileSync(changelogPath, "utf8");

test("verified places use authoritative identities and geographic coordinates", () => {
  assert.match(migration, /CREATE TABLE places/u);
  assert.match(migration, /authority_identifier/u);
  assert.match(migration, /verification_status/u);
  assert.match(migration, /geometry geometry\(Point, 4326\)/u);
  assert.match(migration, /GEOID 0535710/u);
  assert.match(migration, /U\.S\. Census Bureau TIGERweb/u);
});

test("burials reference verified death places separately from cemetery locations", () => {
  assert.match(migration, /ADD COLUMN death_place_uuid uuid REFERENCES places\(id\)/u);
  assert.match(migration, /CREATE TABLE burial_place_evidence/u);
  assert.match(migration, /place_role IN \('birth', 'death', 'funeral', 'residence', 'other'\)/u);
});

test("William Wiskeman death place links NHG Church Records evidence to Jonesboro", () => {
  assert.match(migration, /william c wiskeman/u);
  assert.match(migration, /'death_place'/u);
  assert.match(migration, /'Jonesboro, Arkansas'/u);
  assert.match(migration, /source_page_number = 204/u);
  assert.match(migration, /promoted_burial_uuid/u);
});

test("verified death-place migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/239-verified-places-and-burial-death-location\.sql/u);
});
