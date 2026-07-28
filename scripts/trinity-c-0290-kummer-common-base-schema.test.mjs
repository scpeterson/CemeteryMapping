import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../db/changelog/changes/269-model-c-0290-kummer-common-base-markers.sql", import.meta.url),
  "utf8",
);
const rootChangelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("Kummer common base migration creates distinct Dora and Christ upright markers", () => {
  assert.match(migration, /headstone_id = 'TLC-HS-0290'/u);
  assert.match(migration, /'TLC-HS-0290A'/u);
  assert.match(migration, /marker_types\.code = 'upright_headstone'/u);
  assert.match(migration, /marker_material_types\.code = 'gray_granite'/u);
  assert.match(migration, /headstone_condition_types\.code = 'excellent'/u);
  assert.match(migration, /marker_scope_types\.code = 'single'/u);
  assert.match(migration, /E'Dora Kummer\\n1826-1926'/u);
  assert.match(migration, /E'Christ Kummer\\n1827-1895'/u);
});

test("Kummer individual marker points preserve the one shared GPS observation", () => {
  assert.match(migration, /sharedGpsLatitude/u);
  assert.match(migration, /sharedGpsLongitude/u);
  assert.match(migration, /2 \* 0[.]3048, pi\(\)/u);
  assert.match(migration, /2 \* 0[.]3048, 0/u);
  assert.match(migration, /fieldPhotoFilename/u);
  assert.match(migration, /E6095FF6-34DD-4DB5-882E-42260D905B07_1_105_c[.]jpeg/u);
});

test("Kummer markers receive separate burial and primary gravesite links", () => {
  assert.match(migration, /retired_dora_christ_burial_link/u);
  assert.match(migration, /SELECT dora_marker_uuid, dora_burial_uuid/u);
  assert.match(migration, /SELECT christ_marker_uuid, christ_burial_uuid/u);
  assert.match(migration, /retired_dora_christ_gravesite_link/u);
  assert.match(migration, /dora_gravesite_uuid, 'primary'/u);
  assert.match(migration, /christ_gravesite_uuid, 'primary'/u);
});

test("Kummer markers are connected by a high-confidence NHG common-base relationship", () => {
  assert.match(migration, /'common_base'/u);
  assert.match(migration, /'nhg'/u);
  assert.match(migration, /'high'/u);
  assert.match(migration, /one GPS coordinate documents the complete structure/u);
});

test("Kummer NHG entries and shared photograph link to the corresponding records", () => {
  assert.match(migration, /north_hills_ocr_entry_headstone_links/u);
  assert.match(migration, /north_hills_ocr_entry_gravesite_links/u);
  assert.match(migration, /parsed_position_number IN \(10, 11\)/u);
  assert.match(migration, /INSERT INTO headstone_media_assets/u);
  assert.match(migration, /Shared field photograph documents both Kummer upright markers/u);
});

test("Kummer common base migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/269-model-c-0290-kummer-common-base-markers[.]sql/u);
});
