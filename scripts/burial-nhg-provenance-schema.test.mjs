import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../db/changelog/changes/246-burial-source-provenance.sql", import.meta.url), "utf8");
const rootChangelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");
const mutation = readFileSync(new URL("../server/cemeteryHeadstoneMutations.mjs", import.meta.url), "utf8");
const detailPanel = readFileSync(new URL("../src/components/DetailPanel.tsx", import.meta.url), "utf8");

test("burials support structured NHG provenance", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS source_properties jsonb/u);
  assert.match(migration, /burials_nhg_inclusion_idx/u);
  assert.match(rootChangelog, /changes\/246-burial-source-provenance\.sql/u);
});

test("marker updates can explicitly propagate NHG inclusion to burials", () => {
  assert.match(detailPanel, /Apply this NHG inclusion status to associated burials/u);
  assert.match(mutation, /headstone\.applyNhgInclusionToBurials/u);
  assert.match(mutation, /'nhgInclusion', \$2/u);
  assert.match(mutation, /Status propagated from the associated marker/u);
});

test("propagation preserves genuine linked NHG evidence", () => {
  assert.match(mutation, /north_hills_ocr_entry_headstone_links/u);
  assert.match(mutation, /source_person_record_links/u);
  assert.match(mutation, /north_hills_ocr_source_fact_id IS NOT NULL/u);
});
