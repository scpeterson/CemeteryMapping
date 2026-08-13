import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("structured ownership parties support names, addresses, and recipient-only current owners", async () => {
  const sql = await readFile(new URL("../db/changelog/changes/317-structured-ownership-parties.sql", import.meta.url), "utf8");
  assert.match(sql, /ADD COLUMN first_name/u);
  assert.match(sql, /ADD COLUMN last_name/u);
  assert.match(sql, /full_address/u);
  assert.match(sql, /ownership_role IN \('owner', 'grantee'\)/u);
  assert.match(sql, /DROP VIEW IF EXISTS current_ownership_right_owners/u);
});
