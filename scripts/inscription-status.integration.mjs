import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";

test("inscription migration converts whole tokens, preserves partial text and enforces database status rules", async () => {
  const pool = new pg.Pool(integrationAdminDatabase(loadApiConfig()));
  const client = await pool.connect();
  const schema = `inscription_${randomUUID().replaceAll("-", "")}`;
  try {
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path=${schema},public;
      CREATE TABLE headstones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),inscription text);`);
    await client.query(await readFile(new URL("../db/changelog/changes/409-marker-faces.sql", import.meta.url), "utf8"));
    const partial = "  NAME\n[blank] – [illegible]\n[illegible lines]  ";
    const { rows: originals } = await client.query("INSERT INTO headstones(inscription) VALUES ($1),($2),($3),(NULL) RETURNING *", [" \n[blank]\t", "[illegible]", partial]);
    await client.query(await readFile(new URL("../db/changelog/changes/478-inscription-status.sql", import.meta.url), "utf8"));
    for (const [index, status] of ["blank", "illegible", "transcribed", "not_recorded"].entries()) {
      const { rows: [row] } = await client.query("SELECT * FROM headstones WHERE id=$1", [originals[index].id]);
      assert.equal(row.inscription_status, status);
      if (index < 2) { assert.equal(row.inscription, ""); assert.equal(row.faces[0].inscriptionStatus, status); }
      if (index === 2) { assert.equal(row.inscription, partial); assert.equal(row.faces[0].inscription, partial); }
    }
    for (const status of ["blank", "illegible"]) {
      await client.query("SAVEPOINT bad_root");
      await assert.rejects(client.query("UPDATE headstones SET inscription_status=$2,inscription='Text' WHERE id=$1", [originals[3].id, status]), /cannot contain text/);
      await client.query("ROLLBACK TO SAVEPOINT bad_root");
      await client.query("SAVEPOINT bad_face");
      const face = { ...originals[0].faces[0], inscriptionStatus: status, inscription: " " };
      await assert.rejects(client.query("UPDATE headstones SET faces=$2::jsonb WHERE id=$1", [originals[0].id, JSON.stringify([face])]), /cannot contain text/);
      await client.query("ROLLBACK TO SAVEPOINT bad_face");
    }
    const { rows: [legacyInsert] } = await client.query("INSERT INTO headstones(inscription) VALUES ('Legacy import') RETURNING *");
    assert.equal(legacyInsert.inscription_status, "transcribed");
    assert.equal(legacyInsert.faces[0].inscriptionStatus, "transcribed");
    await client.query("CREATE TEMP TABLE legacy_fixture (LIKE headstones INCLUDING DEFAULTS)");
    assert.equal((await client.query("INSERT INTO legacy_fixture(inscription) VALUES (NULL) RETURNING inscription_status")).rows[0].inscription_status, "not_recorded");
    const id = originals[2].id;
    await client.query("UPDATE headstones SET faces='[]'::jsonb WHERE id=$1", [id]);
    const { rows: [empty] } = await client.query("SELECT * FROM headstones WHERE id=$1", [id]);
    assert.equal(empty.inscription, null);
    assert.equal(empty.inscription_status, "not_recorded");
    await client.query("UPDATE headstones SET inscription_status='blank',inscription=NULL WHERE id=$1", [id]);
    assert.equal((await client.query("SELECT inscription_status FROM headstones WHERE id=$1", [id])).rows[0].inscription_status, "blank");
    await client.query("UPDATE headstones SET inscription_status='transcribed',inscription=$2 WHERE id=$1", [id, partial]);
    assert.equal((await client.query("SELECT faces FROM headstones WHERE id=$1", [id])).rows[0].faces[0].inscription, partial);
  } finally { await client.query("ROLLBACK"); client.release(); await pool.end(); }
});
