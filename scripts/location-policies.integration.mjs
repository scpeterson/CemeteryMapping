import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createGraveSpaceMutation } from "../server/cemeteryGraveMutations.mjs";
import { loadDbEnvironment } from "./lib/run-liquibase.mjs";
const env = loadDbEnvironment("test");
assert.notEqual(env.POSTGRES_DB, "cemetery_mapping_dev");
const config = {host:"127.0.0.1",port:Number(env.POSTGRES_PORT),database:env.POSTGRES_DB,user:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD,statement_timeout:15000,lock_timeout:5000};
const geometry = "ST_Multi(ST_GeomFromText('POLYGON((-80 40,-79.99 40,-79.99 40.01,-80 40.01,-80 40))',4326))";
const flush = async c => {await c.query("SET CONSTRAINTS ALL IMMEDIATE");await c.query("SET CONSTRAINTS ALL DEFERRED");};
async function fixture(c) {
 const cemetery=randomUUID(),section=randomUUID(),block=randomUUID(),grave=randomUUID();
 await c.query(`INSERT INTO cemeteries(id,name,geometry) VALUES($1,$2,${geometry})`,[cemetery,"Policy regression "+cemetery]);
 await c.query(`INSERT INTO sections(section_id,cemetery_id,name,geometry) VALUES($1,$2,'G',${geometry})`,[section,cemetery]);
 await c.query(`INSERT INTO blocks(id,cemetery_id,section_uuid,section_id,block_id,geometry) VALUES($1,$2,$3,'G','1',${geometry})`,[block,cemetery,section]);
 await c.query(`INSERT INTO gravesites(id,cemetery_id,section_uuid,section_id,block_uuid,grave_id,gravesite_id,status_type_id,geometry)
 VALUES($1,$2,$3,'G',$4,'1',$5,(SELECT id FROM gravesite_status_types WHERE code='available'),${geometry})`,[grave,cemetery,section,block,'POL-'+grave.slice(0,20)]);
 return {cemetery,section,block,grave};
}
async function policy(c,f,scope,rule,enabled) {
 await c.query(`INSERT INTO location_policies(cemetery_id,section_uuid,block_uuid,rule_key,enabled,reason)
 VALUES($1,$2,$3,$4,$5,'Regression policy')`,[scope==='system'?null:f.cemetery,['section','block'].includes(scope)?f.section:null,scope==='block'?f.block:null,rule,enabled]);
}
async function resolved(c,f,rule) {return (await c.query('SELECT gravesite_location_policy($1,$2) AS enabled',[f.grave,rule])).rows[0].enabled;}
async function rejected(c,run,code) {
 await c.query('SAVEPOINT expected_policy_error');
 try {await assert.rejects(async()=>{await run();await flush(c);},e=>e.code===code);}
 finally {await c.query('ROLLBACK TO SAVEPOINT expected_policy_error');await c.query('RELEASE SAVEPOINT expected_policy_error');}
}
test('typed policies inherit by identity, with false overrides and no cross-cemetery letter leakage',async()=>{
 const c=new pg.Client(config);await c.connect();
 try {
  await c.query('BEGIN');const a=await fixture(c),b=await fixture(c);
  assert.equal(await resolved(c,a,'flat_markers_only'),false);
  await policy(c,a,'system','flat_markers_only',true);
  assert.equal(await resolved(c,b,'flat_markers_only'),true);
  await policy(c,a,'cemetery','flat_markers_only',false);
  assert.equal(await resolved(c,a,'flat_markers_only'),false);
  await policy(c,a,'section','flat_markers_only',true);
  assert.equal(await resolved(c,a,'flat_markers_only'),true);
  await policy(c,a,'block','flat_markers_only',false);
  assert.equal(await resolved(c,a,'flat_markers_only'),false);
  await c.query("DELETE FROM location_policies WHERE cemetery_id IS NULL");
  assert.equal(await resolved(c,b,'flat_markers_only'),false);
  await c.query("UPDATE sections SET name='Renamed' WHERE section_id=$1",[a.section]);await flush(c);
  assert.equal(await resolved(c,a,'flat_markers_only'),false);
  await c.query('DELETE FROM location_policies WHERE block_uuid=$1',[a.block]);await flush(c);
  assert.equal(await resolved(c,a,'flat_markers_only'),true);
  assert.equal(await resolved(c,b,'flat_markers_only'),false);
  await c.query('SET LOCAL ROLE cemetery_api');
  for(const table of ['location_policies','location_policy_revision','location_burial_capacity_claims']) {
   const privileges=(await c.query("SELECT has_table_privilege(current_user,$1,'SELECT') AS readable, has_table_privilege(current_user,$1,'UPDATE') AS writable",[table])).rows[0];
   assert.deepEqual(privileges,{readable:true,writable:false});
  }
 } finally {await c.query('ROLLBACK');await c.end();}
});
test('policy values, ancestry, existing data and restoration are validated',async()=>{
 const c=new pg.Client(config);await c.connect();
 try {
  await c.query('BEGIN');const a=await fixture(c),b=await fixture(c);
  await rejected(c,()=>policy(c,a,'section','arbitrary_script',true),'23514');
  await rejected(c,()=>c.query("INSERT INTO location_policies(cemetery_id,section_uuid,rule_key,enabled,reason) VALUES($1,$2,'flat_markers_only',true,'Wrong cemetery')",[b.cemetery,a.section]),'23514');
  await rejected(c,()=>c.query('UPDATE gravesites SET section_uuid=$2 WHERE id=$1',[a.grave,b.section]),'23514');
  await policy(c,a,'block','flat_markers_only',true);
  await rejected(c,()=>c.query("UPDATE gravesites SET block_uuid=NULL,block_id='1' WHERE id=$1",[a.grave]),'23514');
  await c.query('UPDATE gravesites SET section_uuid=NULL WHERE id=$1',[a.grave]);await flush(c);
  await policy(c,a,'section','flat_markers_only',true);
  await rejected(c,()=>c.query("UPDATE sections SET name='Renamed G' WHERE section_id=$1",[a.section]),'23514');
  await c.query('UPDATE gravesites SET section_uuid=$2 WHERE id=$1',[a.grave,a.section]);await flush(c);
  await rejected(c,()=>policy(c,a,'section','no_gravesites',true),'23514');
  await c.query('UPDATE gravesites SET deleted_at=now() WHERE id=$1',[a.grave]);await flush(c);
  await policy(c,a,'section','no_gravesites',true);await flush(c);
  await rejected(c,()=>c.query('UPDATE gravesites SET deleted_at=NULL WHERE id=$1',[a.grave]),'23514');
  await c.query("UPDATE sections SET name='Other' WHERE section_id=$1",[b.section]);await flush(c);
  await rejected(c,()=>c.query('UPDATE sections SET cemetery_id=$2 WHERE section_id=$1',[a.section,b.cemetery]),'23514');
 } finally {await c.query('ROLLBACK');await c.end();}
});
test('unconfigured G permits multiple non-flat markers; a conflicting scoped policy is rejected',async()=>{
 const c=new pg.Client(config);await c.connect();
 try {
  await c.query('BEGIN');const a=await fixture(c);
  for(let i=0;i<2;i++)await c.query("INSERT INTO headstones(gravesite_uuid,marker_type_id) VALUES($1,(SELECT id FROM marker_types WHERE code='footstone'))",[a.grave]);
  await flush(c);
  await rejected(c,()=>policy(c,a,'section','flat_markers_only',true),'23514');
  await rejected(c,()=>policy(c,a,'section','single_primary_marker',true),'23514');
 } finally {await c.query('ROLLBACK');await c.end();}
});
test('older repeatable-read writers cannot bypass a newly enabled policy',async()=>{
 const owner=new pg.Client(config),writer=new pg.Client(config);await owner.connect();await writer.connect();let f;
 try {
  f=await fixture(owner);
  await writer.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  assert.equal(await resolved(writer,f,'flat_markers_only'),false);
  await policy(owner,f,'section','flat_markers_only',true);
  await assert.rejects(writer.query("INSERT INTO headstones(gravesite_uuid,marker_type_id) VALUES($1,(SELECT id FROM marker_types WHERE code='footstone'))",[f.grave]),e=>e.code==='40001');
 } finally {
  await writer.query('ROLLBACK');await writer.end();
  if(f){await owner.query('BEGIN');await owner.query('DELETE FROM gravesites WHERE cemetery_id=$1',[f.cemetery]);await owner.query('DELETE FROM blocks WHERE cemetery_id=$1',[f.cemetery]);await owner.query('DELETE FROM sections WHERE cemetery_id=$1',[f.cemetery]);await owner.query('DELETE FROM cemeteries WHERE id=$1',[f.cemetery]);await owner.query('COMMIT');}
  await owner.end();
 }
});

test('shared-marker policy combines every active association and ignores deleted links',async()=>{
 const c=new pg.Client(config);await c.connect();
 try {
  await c.query('BEGIN');const a=await fixture(c),b=await fixture(c);
  await policy(c,a,'section','flat_markers_only',true);
  const marker=(await c.query("INSERT INTO headstones(gravesite_uuid,marker_type_id) VALUES($1,(SELECT id FROM marker_types WHERE code='flat_marker')) RETURNING id",[b.grave])).rows[0].id;
  const read=async()=> (await c.query('SELECT headstone_requires_flat_marker($1) AS required',[marker])).rows[0].required;
  assert.equal(await read(),false);
  await c.query("INSERT INTO headstone_gravesites(headstone_uuid,gravesite_uuid,relationship_type) VALUES($1,$2,'spans')",[marker,a.grave]);
  assert.equal(await read(),true);
  await c.query('UPDATE headstone_gravesites SET deleted_at=now() WHERE headstone_uuid=$1',[marker]);
  assert.equal(await read(),false);await flush(c);
 }finally{await c.query('ROLLBACK');await c.end();}
});

for(const isolation of ['READ COMMITTED','REPEATABLE READ'])test(`capacity policy rejects competing casket burials under ${isolation}`,async()=>{
 const setup=new pg.Client(config),a=new pg.Client(config),b=new pg.Client(config);await Promise.all([setup.connect(),a.connect(),b.connect()]);let f;
 const burial=(c,grave)=>c.query("INSERT INTO burials(gravesite_uuid,first_name,last_name,full_name,interment_type_id,burial_record_status_type_id) VALUES($1,'Policy','Test','Policy Test',(SELECT id FROM burial_interment_types WHERE code='casket'),(SELECT id FROM burial_record_status_types WHERE code='interred'))",[grave]);
 try {
  f=await fixture(setup);await policy(setup,f,'section','casket_or_two_urns',true);
  await a.query('BEGIN ISOLATION LEVEL '+isolation);await b.query('BEGIN ISOLATION LEVEL '+isolation);
  await resolved(b,f,'casket_or_two_urns');
  await burial(a,f.grave);
  const second=burial(b,f.grave).then(()=>b.query('COMMIT'));
  const rejects=assert.rejects(second,e=>['23514','40001'].includes(e.code));
  await a.query('COMMIT');await rejects;await b.query('ROLLBACK');
  assert.equal(Number((await setup.query('SELECT count(*) FROM burials WHERE gravesite_uuid=$1',[f.grave])).rows[0].count),1);
 } finally {
  await Promise.all([a.query('ROLLBACK'),b.query('ROLLBACK')]);await Promise.all([a.end(),b.end()]);
  if(f){await setup.query('BEGIN');await setup.query('DELETE FROM burials WHERE gravesite_uuid=$1',[f.grave]);await setup.query('DELETE FROM gravesites WHERE cemetery_id=$1',[f.cemetery]);await setup.query('DELETE FROM blocks WHERE cemetery_id=$1',[f.cemetery]);await setup.query('DELETE FROM sections WHERE cemetery_id=$1',[f.cemetery]);await setup.query('DELETE FROM cemeteries WHERE id=$1',[f.cemetery]);await setup.query('COMMIT');}await setup.end();
 }
});

test('interactive creation resolves block overrides and records canonical ancestry',async()=>{
 const pool=new pg.Pool(config),setup=await pool.connect();let f;
 try {
  f=await fixture(setup);
  await setup.query(`INSERT INTO lots(cemetery_id,section_uuid,block_uuid,section_id,block_id,lot_id,geometry)
    VALUES($1,$2,$3,'G','1','1',${geometry})`,[f.cemetery,f.section,f.block]);
  await policy(setup,f,'section','no_interactive_creation',true);
  await policy(setup,f,'block','no_interactive_creation',false);
  const input={status:'available',cost:'',longitude:-79.995,latitude:40.005};
  const load=async(c,cemetery,id)=>(await c.query('SELECT id,section_uuid,block_uuid FROM gravesites WHERE cemetery_id=$1 AND gravesite_id=$2',[cemetery,id])).rows[0];
  const created=await createGraveSpaceMutation(pool,f.cemetery,input,{},load);
  assert.equal(created.section_uuid,f.section);assert.equal(created.block_uuid,f.block);
  await setup.query("UPDATE location_policies SET enabled=true WHERE block_uuid=$1 AND rule_key='no_interactive_creation'",[f.block]);
  assert.deepEqual(await createGraveSpaceMutation(pool,f.cemetery,input,{},load),{invalid:'section_not_allowed',section:'G'});
 } finally {
  if(f){await setup.query('BEGIN');await setup.query('DELETE FROM gravesites WHERE cemetery_id=$1',[f.cemetery]);await setup.query('DELETE FROM lots WHERE cemetery_id=$1',[f.cemetery]);await setup.query('DELETE FROM blocks WHERE cemetery_id=$1',[f.cemetery]);await setup.query('DELETE FROM sections WHERE cemetery_id=$1',[f.cemetery]);await setup.query('DELETE FROM cemeteries WHERE id=$1',[f.cemetery]);await setup.query('COMMIT');}setup.release();await pool.end();
 }
});
