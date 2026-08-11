import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../db/changelog/changes/311-add-unknown-interment-type.sql", import.meta.url);

test("unknown interment type supports pre-need and unverified records", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /'unknown'/u);
  assert.match(sql, /Unknown or not applicable/u);
  assert.match(sql, /terry m eckendahl/u);
  assert.match(sql, /pre_need_inscription/u);
});
