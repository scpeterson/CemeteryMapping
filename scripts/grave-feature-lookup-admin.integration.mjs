import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";
import { createLookupRecord, updateLookupRecord, listLookupRecords } from "../server/lookupAdminRepository.mjs";

import { listHeadstoneLookupOptions } from "../server/cemeteryLookupQueries.mjs";

const tables = ["grave_feature_types", "grave_feature_subtypes", "grave_feature_material_types", "grave_feature_placement_types"];
const input = (code, extra = {}) => ({ code, label: code, description: `Description of ${code}`, isActive: true, ...extra });

test("shared grave feature lookups retain cross-cemetery references, subtype parents and inactive history", async () => {
  const client = new pg.Client(integrationAdminDatabase(loadApiConfig()));
  await client.connect();
  try {
    await client.query("BEGIN");
    for (const table of [...tables, "grave_features"]) {
      await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
    }
    const pool = { connect: async () => ({ query: (sql, values) => client.query(
      sql === "BEGIN" ? "SAVEPOINT lookup_edit" : sql === "COMMIT" ? "RELEASE SAVEPOINT lookup_edit" : sql === "ROLLBACK" ? "ROLLBACK TO SAVEPOINT lookup_edit" : sql, values,
    ), release() {} }) };
    const type = await createLookupRecord(pool, tables[0], input("holder"), { actorUser: { role: "admin", email: "admin@example.test" } });
    assert.equal((await client.query("SELECT current_setting('app.audit.role') AS role")).rows[0].role, "admin");
    const otherType = await createLookupRecord(pool, tables[0], input("plaque"));
    const subtype = await createLookupRecord(pool, tables[1], input("star", { graveFeatureTypeId: type.id }));
    const generic = await createLookupRecord(pool, tables[1], input("other", { graveFeatureTypeId: null }));
    const material = await createLookupRecord(pool, tables[2], input("bronze"));
    const placement = await createLookupRecord(pool, tables[3], input("attached"));
    for (const cemeteryId of [randomUUID(), randomUUID()]) {
      await client.query(`INSERT INTO grave_features(cemetery_id,gravesite_uuid,feature_type_id,feature_subtype_id,material_type_id,placement_type_id)
        VALUES($1,$2,$3,$4,$5,$6)`, [cemeteryId, randomUUID(), type.id, subtype.id, material.id, placement.id]);
    }
    const options = await listHeadstoneLookupOptions(pool, { includeEntities: false });
    assert.equal(options.graveFeatureSubtypes.find(r => r.id === subtype.id).featureTypeCode, "holder");
    assert.equal(options.graveFeatureSubtypes.find(r => r.id === generic.id).featureTypeCode, null);
    const listed = await listLookupRecords(pool);
    assert.equal(listed.tables.find(t => t.table === tables[1]).hasGraveFeatureType, true);
    assert.equal(listed.lookups[tables[1]].find(r => r.id === subtype.id).graveFeatureTypeId, type.id);
    assert.equal(listed.lookups[tables[1]].find(r => r.id === generic.id).graveFeatureTypeId, null);
    for (const [table, row] of [[tables[0], type], [tables[1], subtype], [tables[2], material], [tables[3], placement]]) {
      assert.equal(listed.lookups[table].find(r => r.id === row.id).usageCount, 2);
      const saved = await updateLookupRecord(pool, table, row.id, { ...row, label: "Edited " + row.label, isActive: false });
      assert.equal(saved.label, "Edited " + row.label);
      assert.equal(saved.isActive, false);
      assert.equal(saved.usageCount, 2);
    }
    const activeOptions = await listHeadstoneLookupOptions(pool, { includeEntities: false });
    for (const [key, row] of [["graveFeatureTypes", type], ["graveFeatureSubtypes", subtype], ["graveFeatureMaterials", material], ["graveFeaturePlacements", placement]]) assert.ok(!activeOptions[key].some(r => r.id === row.id));
    assert.equal((await client.query("SELECT count(*) FROM grave_features WHERE feature_type_id=$1 AND feature_subtype_id=$2 AND material_type_id=$3 AND placement_type_id=$4", [type.id, subtype.id, material.id, placement.id])).rows[0].count, "2");
    await assert.rejects(createLookupRecord(pool, tables[1], input("inactive_parent", { graveFeatureTypeId: type.id })), /active grave feature type/);
    await assert.rejects(createLookupRecord(pool, tables[1], input("missing_parent", { graveFeatureTypeId: randomUUID() })), /active grave feature type/);
    for (const parent of [otherType.id, null]) {
      await assert.rejects(updateLookupRecord(pool, tables[1], subtype.id, { ...subtype, graveFeatureTypeId: parent }), /cannot be changed/);
    }
    await assert.rejects(updateLookupRecord(pool, tables[1], generic.id, { ...generic, graveFeatureTypeId: otherType.id }), /cannot be changed/);
    assert.equal((await updateLookupRecord(pool, tables[1], generic.id, { ...generic, label: "Generic edited" })).graveFeatureTypeId, null);
    assert.equal(await updateLookupRecord(pool, tables[1], randomUUID(), generic), undefined);
    await client.query("UPDATE grave_features SET deleted_at=now() WHERE id=(SELECT id FROM grave_features LIMIT 1)");
    assert.equal((await listLookupRecords(pool)).lookups[tables[1]].find(r => r.id === subtype.id).usageCount, 1);
  } finally { await client.query("ROLLBACK"); await client.end(); }
});
