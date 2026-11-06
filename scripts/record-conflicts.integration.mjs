import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";
import { updateBurial, getBurial } from "../server/cemeteryBurialMutations.mjs";
import { updateHeadstone, getHeadstone } from "../server/cemeteryRepository.mjs";
import { validateBurialPayload } from "../server/routes/cemeteryRouteValidation.mjs";
import { readOwnerEdit } from "../server/ownerEditVersion.mjs";
import { updateOwnershipParty } from "../server/cemeteryOwnershipMutations.mjs";
import { createUser, updateUser, selectUserById } from "../server/adminRepository.mjs";
import { getProfile, updateProfile } from "../server/profileRepository.mjs";

test("concurrent record editors allow one writer and preserve the winner across burial, marker, owner, account and profile saves",async()=>{
  const config=integrationAdminDatabase(loadApiConfig());
  const admin=new pg.Client(config);await admin.connect();
  const schema=`record_conflicts_${randomUUID().replaceAll("-","")}`;
  let pool;
  try{
    await admin.query(`CREATE SCHEMA ${schema}`);
    // Real commits and independent connections are necessary to test xmin. Shadow
    // only writable tables in a disposable schema; production data stays read-only.
    for(const table of ["burials","burial_military_decorations","headstones","audit_events","ownership_parties","ownership_events","ownership_event_parties","app_users","app_user_cemetery_access"]){
      await admin.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
    }
    pool=new pg.Pool({...config,max:4,options:`-c search_path=${schema},public -c statement_timeout=15000 -c lock_timeout=10000`});
    const grave=(await pool.query("SELECT id,cemetery_id FROM gravesites WHERE deleted_at IS NULL LIMIT 1")).rows[0];
    assert.ok(grave);
    const actor={role:"admin",subject:"record-conflict-fixture",email:"fixture@example.test"};
    async function race(first,second){
      const outcomes=await Promise.allSettled([first(),second()]);
      assert.equal(outcomes.filter(o=>o.status==="fulfilled").length,1);
      const failure=outcomes.find(o=>o.status==="rejected");assert.equal(failure.reason.name,"ConflictError");
    }
    const burialId=randomUUID();
    await pool.query(`INSERT INTO burials(id,gravesite_uuid,first_name,last_name,full_name,interment_type_id,burial_record_status_type_id)
      VALUES($1,$2,'Fixture','Before','Fixture Before',(SELECT id FROM burial_interment_types WHERE code='unknown'),
        (SELECT id FROM burial_record_status_types WHERE code='interred'))`,[burialId,grave.id]);
    const burial=await getBurial(pool,burialId);
    const burialInput={...validateBurialPayload({firstName:"Fixture",lastName:"Winner"}),expectedVersion:burial.version};
    await race(()=>updateBurial(pool,burialId,burialInput,{actorUser:actor}),()=>updateBurial(pool,burialId,{...burialInput,lastName:"Other winner"},{actorUser:actor}));
    assert.ok(["Winner","Other winner"].includes((await getBurial(pool,burialId)).person.lastName));
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_events WHERE target_table='burials'")).rows[0].n,1);

    const markerId=randomUUID();
    const lookup=(await pool.query("SELECT marker_type_id,marker_scope_type_id,material_type_id,condition_type_id FROM public.headstones WHERE deleted_at IS NULL LIMIT 1")).rows[0];
    await pool.query(`INSERT INTO headstones(id,headstone_id,gravesite_uuid,marker_type_id,marker_scope_type_id,material_type_id,condition_type_id,geometry,faces)
      VALUES($1,'CONFLICT-FIXTURE',$2,$3,$4,$5,$6,ST_SetSRID(ST_MakePoint(0,0),4326),$7::jsonb)`,
    [markerId,grave.id,lookup.marker_type_id,lookup.marker_scope_type_id,lookup.material_type_id,lookup.condition_type_id,
      JSON.stringify([{id:randomUUID(),label:"Front",inscription:"",notes:"",burialIds:[],mediaAssetIds:[]}])]);
    const marker=await getHeadstone(pool,markerId);
    const markerInput={expectedVersion:marker.version,markerTypeId:lookup.marker_type_id,markerScopeId:lookup.marker_scope_type_id,materialId:lookup.material_type_id,conditionId:lookup.condition_type_id,designNotes:"Winner"};
    await race(()=>updateHeadstone(pool,markerId,markerInput,{actorUser:actor}),()=>updateHeadstone(pool,markerId,{...markerInput,designNotes:"Other winner"},{actorUser:actor}));
    assert.ok(["Winner","Other winner"].includes((await getHeadstone(pool,markerId)).designNotes));

    const partyId=randomUUID(),eventId=randomUUID();
    await pool.query("INSERT INTO ownership_parties(id,display_name,first_name,last_name) VALUES($1,'Fixture Owner','Fixture','Owner')",[partyId]);
    await pool.query("INSERT INTO ownership_events(id,cemetery_id,event_type) VALUES($1,$2,'deed')",[eventId,grave.cemetery_id]);
    await pool.query("INSERT INTO ownership_event_parties(ownership_event_uuid,ownership_party_uuid) VALUES($1,$2)",[eventId,partyId]);
    const owner=await readOwnerEdit(pool,partyId,eventId);
    const ownerInput={...owner,expectedVersion:owner.version,lastName:"Winner"};
    assert.equal(await readOwnerEdit(pool,partyId,eventId,[]),undefined);
    await race(()=>updateOwnershipParty(pool,partyId,eventId,ownerInput,{actorUser:actor}),()=>updateOwnershipParty(pool,partyId,eventId,{...ownerInput,lastName:"Other winner"},{actorUser:actor}));

    const subject=`fixture|${randomUUID()}`;
    const userInput={externalSubject:subject,email:`${randomUUID()}@example.test`,displayName:"Fixture",role:"reader",isActive:true,assignedCemeteryIds:[grave.cemetery_id],cemeteryMemberships:[{cemeteryId:grave.cemetery_id,role:"reader"}]};
    const user=await createUser(pool,userInput);
    await pool.query("UPDATE app_user_cemetery_access SET role_name='power-user',can_edit=true WHERE app_user_id=$1",[user.id]);
    await assert.rejects(()=>updateUser(pool,user.id,{...userInput,expectedVersion:user.version}),{name:"ConflictError"});
    assert.equal((await selectUserById(pool,user.id)).cemeteryMemberships[0].role,"power-user");
    const current=await selectUserById(pool,user.id);
    const accountInput={...userInput,cemeteryMemberships:current.cemeteryMemberships,expectedVersion:current.version};
    await race(()=>updateUser(pool,user.id,{...accountInput,displayName:"Winner"}),()=>updateUser(pool,user.id,{...accountInput,displayName:"Other winner"}));
    const profileActor={...actor,id:user.id};
    const profile=await getProfile(pool,profileActor);
    const profileInput={displayName:profile.displayName,phone:"555-0100",organization:"Fixture",preferredCemeteryId:null,expectedVersion:profile.version};
    await race(()=>updateProfile(pool,profileActor,profileInput),()=>updateProfile(pool,profileActor,{...profileInput,phone:"555-0101"}));
  }finally{
    if(pool)await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();
  }
});
