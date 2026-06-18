import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = new URL("../db/changelog/changes/105-create-gravesites-for-missing-shapefile-markers.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("missing shapefile marker gravesites are 4 by 10 feet with the marker centered on the west edge", () => {
  assert.match(migration, /source_markers\.longitude AS west_longitude/u);
  assert.match(migration, /source_markers\.longitude \+ \(\(10\.0 \* 0\.3048\)/u);
  assert.match(migration, /source_markers\.latitude - \(\(4\.0 \* 0\.3048\) \/ 2\.0/u);
  assert.match(migration, /source_markers\.latitude \+ \(\(4\.0 \* 0\.3048\) \/ 2\.0/u);
  assert.match(migration, /width_feet,\n {4}length_feet/u);
  assert.match(migration, /\n {4}4,\n {4}10,/u);
});

test("missing shapefile marker gravesites link markers and burials to the generated gravesites", () => {
  assert.match(migration, /UPDATE headstones/u);
  assert.match(migration, /gravesite_uuid = inserted_gravesites\.id/u);
  assert.match(migration, /INSERT INTO headstone_gravesites/u);
  assert.match(migration, /UPDATE burials/u);
  assert.match(migration, /gravesite_id = updated_headstones\.gravesite_id/u);
  assert.match(migration, /SELECT sections\.section_id, sections\.name/u);
  assert.doesNotMatch(migration, /sections\.id/u);

  for (const gravesiteId of [
    "TLC-GPS-0559",
    "TLC-GPS-0560",
    "TLC-GPS-0561",
    "TLC-GPS-0562",
    "TLC-GPS-0563",
    "TLC-GPS-0564",
    "TLC-GPS-0565",
    "TLC-GPS-0566",
    "TLC-GPS-0567",
    "TLC-GPS-0568",
    "TLC-GPS-0569",
    "TLC-GPS-0570",
    "TLC-GPS-0571",
    "TLC-GPS-0572",
    "TLC-GPS-0573",
  ]) {
    assert.match(migration, new RegExp(`'${gravesiteId}'`, "u"));
  }
});
