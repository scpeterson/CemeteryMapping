import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";

test("current illegibility preserves historical text, provenance, face identity and omitted history", async () => {
  const pool = new pg.Pool(integrationAdminDatabase(loadApiConfig()));
  const c = await pool.connect();
  const schema = `history_${randomUUID().replaceAll("-", "")}`;
  try {
    await c.query("BEGIN");
    await c.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path=${schema},public;
      CREATE TABLE headstones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),headstone_id text,inscription text,
      source_properties jsonb NOT NULL DEFAULT '{}'::jsonb, geometry text, deleted_at timestamptz,updated_at timestamptz,last_inspected_at date);`);
    for (const file of ["409-marker-faces.sql", "478-inscription-status.sql", "479-legibility-and-historical-transcriptions.sql"]) {
      await c.query(await readFile(new URL(`../db/changelog/changes/${file}`, import.meta.url), "utf8"));
    }
    const text = "  AMANDA\n[blank] – 1888\n[illegible lines]  ";
    const { rows: [original] } = await c.query(`INSERT INTO headstones(headstone_id,inscription,geometry,last_inspected_at,source_properties)
      VALUES('TLC-HS-0561',$1,'original-map-location','2026-10-13','{"Person1First":"Amanda L","Person1Last":"Will/Bruermann/Pfeiffer"}') RETURNING *`, [text]);
    await c.query(await readFile(new URL("../db/changelog/changes/480-preserve-b-0561-nhg-historical-inscription.sql", import.meta.url), "utf8"));
    const { rows: [changed] } = await c.query("SELECT * FROM headstones WHERE id=$1", [original.id]);
    assert.equal(changed.current_legibility, "illegible");
    assert.equal(changed.inscription, "");
    assert.equal(changed.historical_transcriptions[0].text, text);
    assert.equal(changed.historical_transcriptions[0].sourceDate, "2005");
    assert.match(changed.historical_transcriptions[0].source, /North Hills Genealogists/u);
    assert.equal(changed.faces[0].id, original.faces[0].id);
    assert.equal(changed.faces[0].historicalTranscriptions[0].text, text);
    assert.equal(changed.geometry, original.geometry);
    assert.equal(changed.last_inspected_at.toISOString(), original.last_inspected_at.toISOString());
    // Older clients can omit history and cannot erase archived evidence.
    const oldClientFace = { ...changed.faces[0] }; delete oldClientFace.historicalTranscriptions;
    await c.query("UPDATE headstones SET faces=$2::jsonb,historical_transcriptions='[]'::jsonb WHERE id=$1", [original.id, JSON.stringify([oldClientFace])]);
    assert.equal((await c.query("SELECT * FROM headstones WHERE id=$1", [original.id])).rows[0].faces[0].historicalTranscriptions[0].text, text);
    // Removing a face preserves its earlier readings at the monument level.
    await c.query("UPDATE headstones SET faces='[]'::jsonb WHERE id=$1", [original.id]);
    assert.equal((await c.query("SELECT * FROM headstones WHERE id=$1", [original.id])).rows[0].historical_transcriptions[0].text, text);
    // Current root transcription becomes history when the surface becomes illegible.
    await c.query("UPDATE headstones SET current_legibility='unknown',inscription_status='transcribed',inscription=$2 WHERE id=$1", [original.id, "Another current reading"]);
    const { rows: [current] } = await c.query("SELECT * FROM headstones WHERE id=$1", [original.id]);
    await c.query("UPDATE headstones SET faces=$2::jsonb WHERE id=$1", [original.id, JSON.stringify([{ ...current.faces[0], inscription: "", inscriptionStatus: "illegible", currentLegibility: "illegible" }])]);
    assert.ok((await c.query("SELECT historical_transcriptions FROM headstones WHERE id=$1", [original.id])).rows[0].historical_transcriptions.some((h) => h.text === "Another current reading"));
    await c.query("SAVEPOINT invalid_text");
    await assert.rejects(c.query("UPDATE headstones SET inscription='Invalid current text' WHERE id=$1", [original.id]), /cannot contain text/);
    await c.query("ROLLBACK TO SAVEPOINT invalid_text");
    await c.query("SAVEPOINT immutable");
    await assert.rejects(c.query("UPDATE headstones SET historical_transcriptions=$2::jsonb WHERE id=$1", [original.id, JSON.stringify([{ ...changed.historical_transcriptions[0], text: "Overwritten evidence" }])]), /immutable/u);
    await c.query("ROLLBACK TO SAVEPOINT immutable");
  } finally { await c.query("ROLLBACK"); c.release(); await pool.end(); }
});
