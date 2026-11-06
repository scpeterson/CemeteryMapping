import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";
import { listCemeteryMembers, saveCemeteryMember } from "../server/cemeteryMembershipRepository.mjs";

test("scoped memberships preserve account identity, other cemeteries, audit and last-admin protection",async()=>{
  const client=new pg.Client(integrationAdminDatabase(loadApiConfig()));await client.connect();
  try{
    await client.query("BEGIN");
    const cemeteries=[randomUUID(),randomUUID()];
    for(const id of cemeteries)await client.query("INSERT INTO cemeteries(id,name,geometry) VALUES($1,'Membership regression',ST_Multi(ST_MakeEnvelope(0,0,1,1,4326)))",[id]);
    const ids=[randomUUID(),randomUUID(),randomUUID()];
    for(let i=0;i<ids.length;i++)await client.query("INSERT INTO app_users(id,external_subject,email,display_name,role_name,is_active) VALUES($1,$2,$3,$4,'reader',true)",[ids[i],`fixture|${ids[i]}`,`${ids[i]}@example.test`,`Membership fixture ${i}`]);
    await client.query(`INSERT INTO app_user_cemetery_access(app_user_id,cemetery_id,role_name,can_edit) VALUES($1,$2,'cemetery-admin',true),($3,$4,'power-user',true)`,[ids[0],cemeteries[0],ids[1],cemeteries[1]]);
    const actor={id:ids[0],subject:`fixture|${ids[0]}`,email:`${ids[0]}@example.test`,role:"cemetery-admin",cemeteryAccess:[{cemeteryId:cemeteries[0],role:"cemetery-admin",canEdit:true}]};
    // Repository transactions become savepoints inside this rollback-only fixture.
    const query=(sql,params)=>client.query(sql==="BEGIN"?"SAVEPOINT member_change":sql==="COMMIT"?"RELEASE SAVEPOINT member_change":sql==="ROLLBACK"?"ROLLBACK TO SAVEPOINT member_change":sql,params);
    const pool={query,connect:async()=>({query,release(){}})};
    const otherBefore=(await client.query("SELECT * FROM app_user_cemetery_access WHERE app_user_id=$1",[ids[1]])).rows;
    const accountBefore=(await client.query("SELECT * FROM app_users WHERE id=$1",[ids[1]])).rows;
    const input={email:`${ids[1]}@example.test`,displayName:"Must not replace profile",role:"reader",reason:"Join this cemetery"};
    assert.deepEqual(await saveCemeteryMember(pool,cemeteries[1],input,actor),{forbidden:true});
    await saveCemeteryMember(pool,cemeteries[0],input,actor);
    assert.deepEqual((await client.query("SELECT * FROM app_users WHERE id=$1",[ids[1]])).rows,accountBefore);
    assert.deepEqual((await client.query("SELECT * FROM app_user_cemetery_access WHERE app_user_id=$1 AND cemetery_id=$2",[ids[1],cemeteries[1]])).rows,otherBefore);
    let listed=await listCemeteryMembers(client,cemeteries[0],{query:ids[1]});assert.equal(listed.length,1);
    await saveCemeteryMember(pool,cemeteries[0],{role:"power-user",expectedVersion:listed[0].version,reason:"Approved editing"},actor,{userId:ids[1]});
    // xmin is constant inside a single outer transaction: use an explicit wrong token.
    await assert.rejects(()=>saveCemeteryMember(pool,cemeteries[0],{role:"reader",expectedVersion:"0",reason:"Stale request"},actor,{userId:ids[1]}),/membership changed/u);
    const administrator=(await listCemeteryMembers(client,cemeteries[0],{query:ids[0]}))[0];
    await assert.rejects(()=>saveCemeteryMember(pool,cemeteries[0],{role:"reader",expectedVersion:administrator.version,reason:"Step down"},actor,{userId:ids[0]}),/last one/u);
    await saveCemeteryMember(pool,cemeteries[0],{role:"cemetery-admin",reason:"Add second administrator",email:`${ids[2]}@example.test`,displayName:""},actor);
    await saveCemeteryMember(pool,cemeteries[0],{role:"reader",expectedVersion:administrator.version,reason:"Hand over administration"},actor,{userId:ids[0],remove:true});
    assert.equal((await listCemeteryMembers(client,cemeteries[0],{query:ids[0]})).length,0);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM audit_events WHERE actor_app_user_id=$1 AND target_table='app_user_cemetery_access'",[actor.id])).rows[0].n>=4,true);
  }finally{await client.query("ROLLBACK");await client.end();}
});
