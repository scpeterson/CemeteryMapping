import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { updateHeadstone } from "../server/cemeteryHeadstoneMutations.mjs";
import { selectHeadstoneById, selectHeadstonesForGrave } from "../server/cemeteryHeadstoneQueries.mjs";
import { ConflictError } from "../server/requestValidation.mjs";
import { toHeadstone } from "../server/cemeteryMappers.mjs";

test("marker faces round-trip with links, legacy text, authorization and stale-write protection", async () => {
  const config = loadApiConfig();
  assert.equal(config.appEnv, "test");
  const pool = new pg.Pool(config.database);
  const client = await pool.connect();
  // Exercise the real mutation, retaining an outer transaction for cleanup.
  const nestedPool = { connect: async () => ({ release() {}, query: (sql, values) => client.query(
    sql === "BEGIN" ? "SAVEPOINT face_write" : sql === "COMMIT" ? "RELEASE SAVEPOINT face_write" : sql === "ROLLBACK" ? "ROLLBACK TO SAVEPOINT face_write" : sql, values) }) };
  try {
    await client.query("BEGIN");
    const { rows: [target] } = await client.query(`SELECT h.id,h.gravesite_uuid FROM headstones h
      JOIN gravesites g ON g.id=h.gravesite_uuid AND g.deleted_at IS NULL
      JOIN headstone_burials hb ON hb.headstone_uuid=h.id AND hb.deleted_at IS NULL
      JOIN burials b ON b.id=hb.burial_uuid AND b.deleted_at IS NULL
      WHERE h.deleted_at IS NULL LIMIT 1`);
    assert.ok(target, "Seed a marker with a burial before running this test");
    const photoId = randomUUID();
    await client.query(`INSERT INTO media_assets(id,cemetery_id,storage_key,file_url,original_filename)
      SELECT $1::uuid, cemetery_id, $1::text, '/media/face-test.jpg', 'face-test.jpg' FROM gravesites WHERE id=$2`, [photoId, target.gravesite_uuid]);
    await client.query("INSERT INTO headstone_media_assets(media_asset_id,headstone_uuid) VALUES ($1,$2)", [photoId,target.id]);
    const original = toHeadstone(await selectHeadstoneById(client, target.id));
    const input = { markerTypeId: original.markerType.id, markerScopeId: original.markerScope.id,
      materialId: original.material.id, conditionId: original.condition.id, inscription: original.inscription,
      facesRevision: original.facesRevision,
      faces: [{ id: randomUUID(), label: "North", inscription: "  Name\nDates  ", notes: "Weathered", burialIds: [original.facePeople[0].id], mediaAssetIds: [photoId] },
        { id: randomUUID(), label: "Base", inscription: "Family\nMemorial", notes: "", burialIds: [original.facePeople[0].id], mediaAssetIds: [photoId] }] };
    assert.equal(await updateHeadstone(nestedPool, target.id, input, { allowedCemeteryIds: [] }), undefined);
    assert.equal((await selectHeadstoneById(client, target.id)).faces_revision, original.facesRevision);
    const saved = await updateHeadstone(nestedPool, target.id, input);
    assert.deepEqual(saved.faces, input.faces);
    assert.equal(saved.facesRevision, original.facesRevision + 1);
    assert.equal(saved.inscription, "North\n  Name\nDates  \n\nBase\nFamily\nMemorial");
    assert.deepEqual(saved.facePeople, original.facePeople);
    assert.ok(saved.mediaAssets.some((asset) => asset.id === photoId));
    const graveRows = await selectHeadstonesForGrave(client, target.gravesite_uuid);
    assert.deepEqual(graveRows.find((h) => h.id === target.id).faces, saved.faces);
    await assert.rejects(updateHeadstone(nestedPool, target.id, input), ConflictError);
    await assert.rejects(updateHeadstone(nestedPool, target.id, { ...input, facesRevision: saved.facesRevision,
      faces: [{ ...input.faces[0], burialIds: [randomUUID()] }] }), { statusCode: 400 });
    await assert.rejects(updateHeadstone(nestedPool, target.id, { ...input, facesRevision: saved.facesRevision,
      faces: [{ ...input.faces[0], mediaAssetIds: [randomUUID()] }] }), { statusCode: 400 });
    await assert.rejects(updateHeadstone(nestedPool, target.id, { ...input, faces: undefined, inscription: "Flattened" }), { statusCode: 400 });
    const cleared = await updateHeadstone(nestedPool, target.id, { ...input, faces: [], facesRevision: saved.facesRevision });
    assert.equal(cleared.inscription, "");
    assert.deepEqual(cleared.faces, []);
    assert.ok(cleared.mediaAssets.some((asset) => asset.id === photoId), "Removing faces preserves marker photos");
    await client.query("UPDATE headstones SET inscription=$2 WHERE id=$1", [target.id, "  Legacy\nText  "]);
    const legacy = toHeadstone(await selectHeadstoneById(client, target.id));
    assert.equal(legacy.faces[0].label, "Unspecified face");
    assert.equal(legacy.faces[0].inscription, "  Legacy\nText  ");
    assert.deepEqual(legacy.faces[0].burialIds, []);
    const { rows: [audit] } = await client.query("SELECT count(*)::int AS count FROM audit_events WHERE target_record_id=$1 AND transaction_id=txid_current() AND new_values ? 'faces'", [target.id]);
    assert.ok(audit.count > 0, "Face changes have audit history");
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});

test("migration preserves legacy inscriptions exactly and does not guess orientation or associations", async () => {
  const { readFile } = await import("node:fs/promises");
  const config = loadApiConfig();
  assert.equal(config.appEnv, "test");
  const pool = new pg.Pool(config.database);
  const client = await pool.connect();
  const schema = `faces_${randomUUID().replaceAll("-", "")}`;
  try {
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path=${schema},public;
      CREATE TABLE headstones (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), inscription text, back_description text);`);
    await client.query("INSERT INTO headstones(inscription,back_description) VALUES ($1,'Uncertain carving'),(NULL,NULL),('',NULL)", ["  OLD\nTEXT  "]);
    await client.query(await readFile(new URL("../db/changelog/changes/409-marker-faces.sql", import.meta.url), "utf8"));
    const { rows: [old] } = await client.query("SELECT * FROM headstones WHERE inscription IS NOT NULL AND inscription<>''");
    assert.equal(old.inscription, "  OLD\nTEXT  ");
    assert.equal(old.faces[0].inscription, old.inscription);
    assert.equal(old.faces[0].label, "Unspecified face");
    assert.deepEqual(old.faces[0].mediaAssetIds, []);
    assert.deepEqual(old.faces[0].burialIds, []);
    assert.equal(old.back_description, "Uncertain carving");
    assert.equal((await client.query("SELECT count(*)::int AS n FROM headstones WHERE faces='[]'::jsonb")).rows[0].n, 2);
    const { rows: [created] } = await client.query("INSERT INTO headstones(inscription) VALUES ('New inscription') RETURNING *");
    assert.equal(created.faces[0].label, "Unspecified face");
    await client.query("UPDATE headstones SET inscription='Corrected' WHERE id=$1", [created.id]);
    assert.equal((await client.query("SELECT faces->0->>'inscription' AS text FROM headstones WHERE id=$1", [created.id])).rows[0].text, "Corrected");
    await client.query("UPDATE headstones SET faces=$2 WHERE id=$1", [created.id, JSON.stringify([
      { id: randomUUID(), label: "North", inscription: "A", notes: "", burialIds: [], mediaAssetIds: [] },
      { id: randomUUID(), label: "Back", inscription: "B", notes: "", burialIds: [], mediaAssetIds: [] },
    ])]);
    await client.query("SAVEPOINT before_legacy_write");
    await assert.rejects(client.query("UPDATE headstones SET inscription='Flattened' WHERE id=$1", [created.id]), /individual marker faces/);
    await client.query("ROLLBACK TO SAVEPOINT before_legacy_write");
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
