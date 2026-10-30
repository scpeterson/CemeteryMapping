import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";
import { getHeadstoneOverview } from "../server/markerOverviewRepository.mjs";

test("marker overview respects active links, direct and inherited rights, and cemetery ownership permissions", async () => {
  const config = loadApiConfig(); assert.equal(config.appEnv, "test");
  const client = new pg.Client(integrationAdminDatabase(config)); await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TEMP TABLE cemeteries(id uuid, deleted_at timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE gravesites(id uuid, gravesite_id text, cemetery_id uuid, lot_uuid uuid, deleted_at timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE headstones(id uuid, gravesite_uuid uuid, deleted_at timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE headstone_gravesites(headstone_uuid uuid, gravesite_uuid uuid, deleted_at timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE burials(id uuid, gravesite_uuid uuid, first_name text, last_name text, maiden_name text,
        name_prefix text, name_suffix text, given_name_status text, display_name text, full_name text,
        birth_date date, birth_date_text text, death_date date, death_date_text text, burial_date date, deleted_at timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE owners(id uuid, gravesite_uuid uuid, owner text, co_owner text, sale_date date, created_at timestamptz, deleted_at timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE current_ownership_right_owners(target_type text, gravesite_uuid uuid, lot_uuid uuid,
        ownership_party_uuid uuid, display_name text, first_name text, last_name text, effective_date date, recorded_at timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE current_ownership_events(target_type text, gravesite_uuid uuid) ON COMMIT DROP;
    `);
    const [cemetery, other, marker, g1, g2, g3, deleted, lot] = Array.from({ length: 8 }, randomUUID);
    await client.query("INSERT INTO cemeteries(id) VALUES($1),($2)", [cemetery, other]);
    for (const [id, name, cem] of [[g1, "1", cemetery], [g2, "2", cemetery], [g3, "3", other], [deleted, "4", cemetery]]) {
      await client.query("INSERT INTO gravesites(id,gravesite_id,cemetery_id,lot_uuid) VALUES($1,$2,$3,$4)", [id, name, cem, lot]);
    }
    await client.query("INSERT INTO headstones(id,gravesite_uuid) VALUES($1,$2)", [marker, g1]);
    for (const id of [g1, g2, g3]) await client.query("INSERT INTO headstone_gravesites VALUES($1,$2,NULL)", [marker, id]);
    await client.query("INSERT INTO headstone_gravesites VALUES($1,$2,now())", [marker, deleted]);
    await client.query("INSERT INTO burials(id,gravesite_uuid,first_name,birth_date_text) VALUES($1,$2,'Alice','1901')", [randomUUID(), g1]);
    await client.query("INSERT INTO burials(id,gravesite_uuid,first_name,deleted_at) VALUES($1,$2,'Deleted',now())", [randomUUID(), g1]);
    await client.query("INSERT INTO owners(id,gravesite_uuid,owner) VALUES($1,$2,'Legacy owner')", [randomUUID(), g1]);
    await client.query("INSERT INTO current_ownership_right_owners(target_type,lot_uuid,ownership_party_uuid,display_name) VALUES('lot',$1,$2,'Inherited owner')", [lot, randomUUID()]);
    await client.query("INSERT INTO current_ownership_right_owners(target_type,gravesite_uuid,ownership_party_uuid,display_name) VALUES('gravesite',$1,$2,'Direct owner')", [g1, randomUUID()]);
    await client.query("INSERT INTO current_ownership_events VALUES('gravesite',$1)", [g1]);
    const result = await getHeadstoneOverview(client, marker, { canViewOwnership: (id) => id === cemetery });
    assert.equal(result.length, 3);
    const first = result.find((grave) => grave.id === "1");
    assert.equal(first.burials.length, 1); assert.equal(first.burials[0].person.birthDate, "1901");
    assert.deepEqual(first.owners.map((owner) => owner.displayName).sort(), ["Direct owner", "Legacy owner"]);
    assert.deepEqual(result.find((grave) => grave.id === "2").owners.map((owner) => owner.displayName), ["Inherited owner"]);
    assert.deepEqual(result.find((grave) => grave.id === "3").owners, []);
    const reader = await getHeadstoneOverview(client, marker);
    assert.ok(reader.every((grave) => grave.owners.length === 0 && grave.currentOwnerIds.length === 0));
    await client.query("UPDATE headstones SET deleted_at=now() WHERE id=$1", [marker]);
    assert.equal(await getHeadstoneOverview(client, marker), undefined);
  } finally { await client.query("ROLLBACK"); await client.end(); }
});
