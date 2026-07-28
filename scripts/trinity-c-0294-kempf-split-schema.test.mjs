import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../db/changelog/changes/270-split-c-0294-kempf-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("C-0294 Kempf split keeps John Peter south and places Anna north", () => {
  assert.match(migration, /AS north_geometry/u);
  assert.match(migration, /AS south_geometry/u);
  assert.match(migration, /name = 'John Peter Kempf'/u);
  assert.match(migration, /'0294A', 'TLC-GPS-0294-01'/u);
  assert.match(migration, /normalized_given_name = 'anna'/u);
  assert.match(migration, /normalized_given_name = 'john'/u);
});

test("C-0294 Kempf split keeps the marker fixed and spans both gravesites", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0294'/u);
  assert.match(migration, /SELECT headstone_uuid, john_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, anna_gravesite_uuid, 'spans'/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry\s*=/u);
});

test("C-0294 Kempf split scopes burial movement through TLC-HS-0294", () => {
  assert.match(migration, /JOIN headstone_burials/u);
  assert.match(migration, /marker_context\.headstone_uuid = headstone_burials\.headstone_uuid/u);
  assert.match(migration, /lower\(COALESCE\(burials\.last_name, ''\)\) = 'kempf'/u);
});

test("C-0294 Kempf split migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/270-split-c-0294-kempf-gravesites\.sql/u);
});
