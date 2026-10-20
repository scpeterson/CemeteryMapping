import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";

test("gravesite labels omit lots when collision-free and retain aliases without changing relationships", async () => {
  const pool = new pg.Pool(integrationAdminDatabase(loadApiConfig()));
  const c = await pool.connect();
  const schema = `grave_labels_${randomUUID().replaceAll("-", "")}`;
  try {
    await c.query("BEGIN");
    await c.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path=${schema},public;
      CREATE TABLE cemeteries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text);
      CREATE TABLE gravesites(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),cemetery_id uuid,gravesite_id text,section_id text,lot_id text,
        grave_id text,lot_uuid uuid DEFAULT gen_random_uuid(),geometry text DEFAULT 'unchanged',deleted_at timestamptz);`);
    const { rows: [cem] } = await c.query("INSERT INTO cemeteries(name) VALUES('Trinity Lutheran Church Cemetery') RETURNING id");
    await c.query(`INSERT INTO gravesites(cemetery_id,gravesite_id,section_id,lot_id,grave_id) VALUES
      ($1,'TLC-GPS-0270','C','52','0270'),($1,'TLC-GPS-0270A','C','52','0270A'),
      ($1,'first-A01','A','1','01'),($1,'second-A01','A','2','01')`, [cem.id]);
    const { rows: before } = await c.query("SELECT * FROM gravesites ORDER BY id");
    await c.query(await readFile(new URL("../db/changelog/changes/481-standardize-gravesite-display-labels.sql", import.meta.url), "utf8"));
    const { rows: after } = await c.query("SELECT * FROM gravesites ORDER BY id");
    assert.deepEqual(after.map((row) => { const rest = { ...row }; delete rest.display_label; delete rest.label_aliases; return rest; }), before);
    const target = after.find((r) => r.gravesite_id === "TLC-GPS-0270");
    assert.equal(target.display_label, "C-0270");
    assert.ok(target.label_aliases.includes("C-52-0270"));
    assert.equal(after.find((r) => r.gravesite_id === "TLC-GPS-0270A").display_label, "C-0270A");
    assert.equal(after.find((r) => r.gravesite_id === "first-A01").display_label, "A-1-01");
    assert.equal(after.find((r) => r.gravesite_id === "second-A01").display_label, "A-2-01");
    await c.query("UPDATE gravesites SET lot_id='23',label_aliases='{}' WHERE id=$1", [target.id]);
    let row = (await c.query("SELECT * FROM gravesites WHERE id=$1", [target.id])).rows[0];
    assert.equal(row.display_label, "C-0270");
    assert.ok(row.label_aliases.includes("C-52-0270"));
    assert.ok(row.label_aliases.includes("C-23-0270"));
    await c.query("UPDATE gravesites SET grave_id='0271' WHERE id=$1", [target.id]);
    row = (await c.query("SELECT * FROM gravesites WHERE id=$1", [target.id])).rows[0];
    assert.equal(row.display_label, "C-0271");
    assert.ok(row.label_aliases.includes("C-0270"));
    await c.query("SAVEPOINT collision");
    await assert.rejects(c.query("INSERT INTO gravesites(cemetery_id,gravesite_id,section_id,lot_id,grave_id) VALUES($1,'duplicate','A','1','01')", [cem.id]), /unique/u);
    await c.query("ROLLBACK TO SAVEPOINT collision");
  } finally { await c.query("ROLLBACK"); c.release(); await pool.end(); }
});

test("application search resolves the same gravesite using canonical labels and stored aliases", async () => {
  const { searchCemetery } = await import("../server/cemeterySearch.mjs");
  const pool = new pg.Pool(loadApiConfig().database);
  try {
    const { rows: [grave] } = await pool.query(`SELECT g.cemetery_id,g.gravesite_id,g.display_label,g.label_aliases
      FROM gravesites g JOIN cemeteries c ON c.id=g.cemetery_id AND c.deleted_at IS NULL
      WHERE g.deleted_at IS NULL AND cardinality(g.label_aliases)>0 ORDER BY g.gravesite_id LIMIT 1`);
    assert.ok(grave, "Seed gravesites with lots before testing alias search");
    for (const query of [grave.display_label, grave.label_aliases[0]]) {
      const result = await searchCemetery(pool, { query, cemeteryId: grave.cemetery_id });
      const found = result.find((match) => match.grave.id === grave.gravesite_id);
      assert.ok(found, `Expected the canonical gravesite for label ${query}`);
      assert.equal(found.grave.displayLabel, grave.display_label);
      assert.deepEqual(found.grave.labelAliases, grave.label_aliases);
    }
  } finally { await pool.end(); }
});
