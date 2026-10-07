import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";
import { selectHeadstonesForGrave } from "../server/cemeteryHeadstoneQueries.mjs";

const primaryGrave = "00000000-0000-4000-8000-000000000001";
const sharedGrave = "00000000-0000-4000-8000-000000000002";

test("grave details return one shared marker with only the selected grave's relationship", async () => {
  const pool = new pg.Pool(integrationAdminDatabase(loadApiConfig()));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const table of ["headstones", "headstone_gravesites", "headstone_burials"]) {
      await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
    }
    const { rows: [marker] } = await client.query(`
      INSERT INTO headstones (headstone_id,gravesite_uuid,marker_type_id,material_type_id,condition_type_id)
      VALUES ('SHARED-MARKER-TEST',$1,
        (SELECT id FROM marker_types LIMIT 1),
        (SELECT id FROM marker_material_types LIMIT 1),
        (SELECT id FROM headstone_condition_types LIMIT 1)) RETURNING id`, [primaryGrave]);
    await client.query(`INSERT INTO headstone_gravesites (headstone_uuid,gravesite_uuid,relationship_type,notes)
      VALUES ($1,$2,'primary','Peter'),($1,$3,'spans','Christina')`, [marker.id, primaryGrave, sharedGrave]);

    async function expectMarker(grave, relationship, notes) {
      const rows = await selectHeadstonesForGrave(client, grave);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, marker.id);
      assert.equal(rows[0].relationship_type, relationship);
      assert.equal(rows[0].relationship_notes, notes);
    }
    await expectMarker(primaryGrave, "primary", "Peter");
    await expectMarker(sharedGrave, "spans", "Christina");
    assert.deepEqual(await selectHeadstonesForGrave(client, "00000000-0000-4000-8000-000000000003"), []);

    // Direct ownership still works without an explicit primary relationship.
    await client.query("DELETE FROM headstone_gravesites WHERE gravesite_uuid=$1", [primaryGrave]);
    await expectMarker(primaryGrave, "primary", null);
    await expectMarker(sharedGrave, "spans", "Christina");

    // A deleted shared relationship must neither show a marker nor leak its notes.
    await client.query("UPDATE headstone_gravesites SET deleted_at=now() WHERE gravesite_uuid=$1", [sharedGrave]);
    assert.deepEqual(await selectHeadstonesForGrave(client, sharedGrave), []);
    await expectMarker(primaryGrave, "primary", null);
    await client.query("UPDATE headstones SET deleted_at=now()");
    assert.deepEqual(await selectHeadstonesForGrave(client, primaryGrave), []);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
