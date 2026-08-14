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

test("gravesite details expose the modern linked lot for whole-lot deeds", async () => {
  const queries = await readFile(new URL("../server/cemeteryGraveQueries.mjs", import.meta.url), "utf8");
  assert.match(queries, /COALESCE\(lots\.lot_id, gravesites\.lot_id\) AS lot_id/u);
});

test("unassigned gravesites offer reviewed spatial inference and admin assignment", async () => {
  const detail = await readFile(new URL("../src/components/DetailPanel.tsx", import.meta.url), "utf8");
  const routes = await readFile(new URL("../server/routes/graveRoutes.mjs", import.meta.url), "utf8");
  assert.match(detail, /inferredLotForGrave/u);
  assert.match(detail, /Review against the paper map before assigning/u);
  assert.match(routes, /requireCemeteryAdmin/u);
  assert.match(routes, /grave-spaces\/:id\/lot/u);
});
