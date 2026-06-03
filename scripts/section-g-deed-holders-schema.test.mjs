import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/042-section-g-deed-holders.sql", import.meta.url);

test("Section G deed holder migration preserves populated plot ownership assignments", async () => {
  const migration = await readFile(migrationPath, "utf8");
  const assignments = [...migration.matchAll(/\('G-\d{3}', '[^']+'\)/gu)].map((match) => match[0]);

  assert.equal(assignments.length, 50);
  assert.match(migration, /\('G-001', 'Irlbacher, A\.'\)/u);
  assert.match(migration, /\('G-007', 'Eshenbuagh, Diane'\)/u);
  assert.match(migration, /\('G-031', 'Eshenbaugh, A & D'\)/u);
  assert.match(migration, /\('G-050', 'Baur, L & R'\)/u);
  assert.match(migration, /\('G-055', 'Baur, L & R'\)/u);
  assert.match(migration, /source heading says Section F, interpreted as Section G/iu);
  assert.match(migration, /target_type,\s+gravesite_uuid/u);
});
