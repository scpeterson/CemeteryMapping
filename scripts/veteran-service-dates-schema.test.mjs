import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../db/changelog/changes/249-veteran-service-dates.sql", import.meta.url), "utf8");
const rootChangelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");
const detailPanel = readFileSync(new URL("../src/components/DetailPanel.tsx", import.meta.url), "utf8");
const burialMutation = readFileSync(new URL("../server/cemeteryBurialMutations.mjs", import.meta.url), "utf8");

test("burials store ordered veteran enlisted and discharged dates", () => {
  assert.match(migration, /military_enlisted_date date/u);
  assert.match(migration, /military_discharged_date date/u);
  assert.match(migration, /military_discharged_date >= military_enlisted_date/u);
  assert.match(rootChangelog, /changes\/249-veteran-service-dates\.sql/u);
});

test("veteran service dates are editable and persisted", () => {
  assert.match(detailPanel, /Enlisted date/u);
  assert.match(detailPanel, /Discharged date/u);
  assert.match(detailPanel, /form\.veteran \?/u);
  assert.match(burialMutation, /military_enlisted_date = \$15::date/u);
  assert.match(burialMutation, /military_discharged_date = \$16::date/u);
});
