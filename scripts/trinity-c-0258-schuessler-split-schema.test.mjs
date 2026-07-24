import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../db/changelog/changes/253-split-c-0258-schuessler-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("C-0258 Schuessler split keeps Walter in the original grave and places Armella north", () => {
  assert.match(migration, /name = 'Walter H Schuessler'/u);
  assert.match(migration, /gravesite_id = 'TLC-GPS-0258'/u);
  assert.match(migration, /'Armella M Schuessler'/u);
  assert.match(migration, /'0258A'/u);
  assert.match(migration, /'TLC-GPS-0258-01'/u);
  assert.match(migration, /north_geometry/u);
  assert.match(migration, /south_geometry/u);
});

test("C-0258 Schuessler split keeps the marker fixed and spans both gravesites", () => {
  assert.doesNotMatch(migration, /UPDATE headstones\s+SET\s+geometry/iu);
  assert.match(migration, /SELECT headstone_uuid, armella_gravesite_uuid, 'spans'/u);
  assert.match(migration, /SELECT headstone_uuid, walter_gravesite_uuid, 'spans'/u);
  assert.match(migration, /gravesite_uuid = marker_context\.walter_gravesite_uuid/u);
});

test("C-0258 Schuessler split scopes burial movement through TLC-HS-0258", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0258'/u);
  assert.match(migration, /headstone_burials\.burial_uuid = burials\.id/u);
  assert.match(migration, /split_part\(trim\(COALESCE\(burials\.first_name/u);
  assert.match(migration, /normalized_given_name = 'armella'/u);
  assert.match(migration, /normalized_given_name = 'walter'/u);
});

test("C-0258 Schuessler split migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/253-split-c-0258-schuessler-gravesites\.sql/u);
});
