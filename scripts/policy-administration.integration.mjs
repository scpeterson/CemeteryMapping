import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
import {changePolicy,policySnapshot} from '../server/locationPolicyAdministration.mjs';
const config=loadApiConfig();assert.equal(config.appEnv,'test');
const geometry="ST_Multi(ST_MakeEnvelope(-80,40,-79.99,40.01,4326))";
async function fixture(){
 const owner=new pg.Pool(integrationAdminDatabase(config)),api=new pg.Pool(config.database);
 const cemetery=randomUUID(),other=randomUUID(),section=randomUUID(),grave=randomUUID(),admin=randomUUID(),manager=randomUUID(),reader=randomUUID();
 const c=await owner.connect();
 try{
  await c.query('BEGIN');
  for(const id of [cemetery,other])await c.query(`INSERT INTO cemeteries(id,name,geometry) VALUES($1,$2,${geometry})`,[id,'Policy admin '+id]);
  await c.query(`INSERT INTO sections(section_id,cemetery_id,name,geometry) VALUES($1,$2,'G',${geometry})`,[section,cemetery]);
  await c.query(`INSERT INTO gravesites(id,cemetery_id,section_uuid,section_id,grave_id,gravesite_id,status_type_id,geometry) VALUES($1,$2,$3,'G','1',$4,(SELECT id FROM gravesite_status_types WHERE code='available'),${geometry})`,[grave,cemetery,section,'PA-'+grave.slice(0,20)]);
  for(const [id,role] of [[admin,'admin'],[manager,'reader'],[reader,'reader']]){
   await c.query('INSERT INTO app_users(id,external_subject,email,role_name) VALUES($1,$2,$3,$4)',[id,'policy-'+id,id+'@example.test',role]);
   if(role!=='admin')await c.query('INSERT INTO app_user_cemetery_access(app_user_id,cemetery_id,role_name,can_edit) VALUES($1,$2,$3,true)',[id,cemetery,id===manager?'cemetery-admin':'power-user']);
  }
  await c.query('COMMIT');
 }finally{c.release();}
 const user={id:manager,role:'cemetery-admin',cemeteryAccess:[{cemeteryId:cemetery,role:'cemetery-admin',canEdit:true}]};
 const input=async(patch={})=>({cemeteryId:cemetery,sectionId:section,blockId:null,rule:'flat_markers_only',value:true,reason:'Reviewed policy test',revision:(await api.query('SELECT revision::text FROM location_policy_revision')).rows[0].revision,...patch});
 const close=async()=>{const c=await owner.connect();try{await c.query('BEGIN');await c.query('DELETE FROM gravesites WHERE cemetery_id=ANY($1::uuid[])',[[cemetery,other]]);await c.query('DELETE FROM sections WHERE cemetery_id=ANY($1::uuid[])',[[cemetery,other]]);await c.query('DELETE FROM app_users WHERE id=ANY($1::uuid[])',[[admin,manager,reader]]);await c.query('DELETE FROM cemeteries WHERE id=ANY($1::uuid[])',[[cemetery,other]]);await c.query('DELETE FROM location_policy_history WHERE cemetery_id=ANY($1::uuid[])',[[cemetery,other]]);await c.query('COMMIT');}finally{c.release();await api.end();await owner.end();}};
 return {owner,api,cemetery,other,section,grave,admin,manager,reader,user,input,close};
}
test('guarded previews roll back policies, revision and history; save is audited and stale edits fail',async()=>{
 const f=await fixture();try{
  const input=await f.input();const preview=await changePolicy(f.api,input,f.user,{preview:true});assert.equal(preview.impact.graves,1);assert.ok(preview.previewToken);
  const unchanged=await f.api.query('SELECT revision::text FROM location_policy_revision');assert.equal(unchanged.rows[0].revision,input.revision);
  assert.equal((await f.api.query('SELECT count(*)::int AS n FROM location_policy_history WHERE cemetery_id=$1',[f.cemetery])).rows[0].n,0);
  const result=await changePolicy(f.api,input,f.user);assert.notEqual(result.revision,input.revision);
  const history=(await f.api.query('SELECT * FROM location_policy_history WHERE cemetery_id=$1',[f.cemetery])).rows[0];assert.equal(history.actor_id,f.manager);assert.equal(history.reason,input.reason);assert.equal(history.before_value,null);assert.equal(history.after_value.enabled,true);
  await assert.rejects(changePolicy(f.api,input,f.user),/preview again|Reload and preview again/);
  await changePolicy(f.api,await f.input({value:null}),f.user);
  assert.equal((await f.api.query('SELECT count(*)::int AS n FROM location_policies WHERE section_uuid=$1',[f.section])).rows[0].n,0);
 }finally{await f.close();}
});
test('conflicting preview rolls back every change and inherited history stays scoped',async()=>{
 const f=await fixture();try{
  const before=await f.input();await assert.rejects(changePolicy(f.api,{...before,rule:'no_gravesites'},f.user,{preview:true}),e=>e.code==='23514');
  assert.equal((await f.api.query('SELECT revision::text FROM location_policy_revision')).rows[0].revision,before.revision);
  await changePolicy(f.api,await f.input(),f.user);
  const snapshot=await policySnapshot(f.api,f.user);assert.ok(snapshot.cemeteries.some(c=>c.id===f.cemetery));assert.ok(!snapshot.cemeteries.some(c=>c.id===f.other));assert.ok(snapshot.history.every(h=>h.cemetery_id===f.cemetery));
  await f.owner.query(`INSERT INTO location_policy_history(actor_id,actor_email,cemetery_id,rule_key,reason,revision,scope_label)
    SELECT $1,'history@example.test',$2,'flat_markers_only','History pagination test',1,'Example cemetery' FROM generate_series(1,101)`,[f.manager,f.cemetery]);
  const first=await policySnapshot(f.api,f.user);assert.equal(first.history.length,100);assert.ok(first.historyCursor);
  const second=await policySnapshot(f.api,f.user,first.historyCursor);assert.equal(second.history.length,2);assert.ok(second.history.every(h=>!first.history.some(a=>a.id===h.id)));
  for(const table of ['location_policies','location_policy_history','location_policy_revision'])assert.equal((await f.api.query("SELECT has_table_privilege(current_user,$1,'UPDATE') AS allowed",[table])).rows[0].allowed,false);
 }finally{await f.close();}
});
test('database permissions defeat forged API roles, cross-cemetery edits, inactive accounts and system edits by cemetery admins',async()=>{
 const f=await fixture();try{
  for(const [user,patch] of [[{id:f.reader,role:'admin'},{}],[f.user,{cemeteryId:f.other,sectionId:null}],[f.user,{cemeteryId:null,sectionId:null}]])await assert.rejects(changePolicy(f.api,await f.input(patch),user),e=>e.code==='42501');
  await f.owner.query('UPDATE app_users SET is_active=false WHERE id=$1',[f.manager]);await assert.rejects(changePolicy(f.api,await f.input(),f.user),e=>e.code==='42501');
  // A real system administrator can change the system scope; rollback preview only.
  const result=await changePolicy(f.api,await f.input({cemeteryId:null,sectionId:null,rule:'no_interactive_creation'}),{id:f.admin,role:'admin'},{preview:true});assert.ok(result.previewToken);
 }finally{await f.close();}
});

test('simultaneous policy saves serialize and only one reviewed revision commits',async()=>{
 const f=await fixture();try{
  const input=await f.input();const results=await Promise.allSettled([changePolicy(f.api,input,f.user),changePolicy(f.api,{...input,value:false},f.user)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
  assert.equal((await f.api.query('SELECT count(*)::int AS n FROM location_policy_history WHERE cemetery_id=$1',[f.cemetery])).rows[0].n,1);
 }finally{await f.close();}
});
