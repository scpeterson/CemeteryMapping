import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/332-split-c-86-0350-brandt-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("C-86-0350 split keeps Herman south and places Allie then Ruth north", () => {
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0350'/u);
  assert.match(migration, /lot_id = '86'/u);
  assert.match(migration, /name = 'Herman P Brant'[\s\S]*geometry = replacement_geometries\.herman_geometry/u);
  assert.match(migration, /'Allie H Brandt'[\s\S]*'0350A'[\s\S]*'TLC-GPS-0350-01'[\s\S]*allie_geometry/u);
  assert.match(migration, /'Ruth Anna Brandt'[\s\S]*'0350B'[\s\S]*'TLC-GPS-0350-02'[\s\S]*ruth_geometry/u);
  assert.match(migration, /4 \* 0\.3048, 0[\s\S]*8 \* 0\.3048, 0/u);
});

test("C-86-0350 split assigns all burials and spans all graves without moving the marker", () => {
  assert.match(migration, /full_name = 'Herman P Brant'/u);
  assert.match(migration, /full_name = 'Allie H Brandt'/u);
  assert.match(migration, /'Ruth Anna', 'Brandt', 'Ruth Anna Brandt'/u);
  assert.match(migration, /DATE '1910-01-01', DATE '1913-01-01'/u);
  assert.match(migration, /headstone_burials\.headstone_uuid = marker_context\.headstone_uuid/u);
  assert.equal((migration.match(/relationship_type = 'spans'/gu) ?? []).length, 1);
  assert.match(migration, /gravesite_uuid = marker_context\.herman_gravesite_uuid/u);
  assert.doesNotMatch(migration, /UPDATE headstones[\s\S]*geometry =/u);
});

test("C-86-0350 split asserts its sources and is included in the root changelog", () => {
  assert.match(migration, /assert_migration_prerequisite/u);
  assert.match(migration, /gravesite_id IN \('TLC-GPS-0349', 'TLC-GPS-0351'\)/u);
  assert.match(migration, /exactly one active Herman P Brandt burial and one active combined Allie H, Ruth Anna Brandt burial/u);
  assert.match(rootChangelog, /changes\/332-split-c-86-0350-brandt-gravesites\.sql/u);
});
