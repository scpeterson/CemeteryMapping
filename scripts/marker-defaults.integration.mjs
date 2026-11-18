import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {loadDbEnvironment} from './lib/run-liquibase.mjs';
const e=loadDbEnvironment('test');
assert.notEqual(e.POSTGRES_DB,'cemetery_mapping_dev');
const config={host:'127.0.0.1',port:Number(e.POSTGRES_PORT),database:e.POSTGRES_DB,user:e.POSTGRES_USER,password:e.POSTGRES_PASSWORD,statement_timeout:10000,lock_timeout:5000};
const geometry="ST_Multi(ST_GeomFromText('POLYGON((-80 40,-79.999 40,-79.999 40.001,-80 40.001,-80 40))',4326))";
async function fixture(c){
 const cemetery=randomUUID(),g=randomUUID(),a=randomUUID(),prefix='MR-'+randomUUID().slice(0,8)+'-HS-';
 await c.query(`INSERT INTO cemeteries(id,name,geometry) VALUES($1,$2,${geometry})`,[cemetery,'Marker regression '+cemetery]);
 for(const [id,section] of [[g,'G'],[a,'A']])await c.query(`INSERT INTO gravesites(id,cemetery_id,section_id,grave_id,gravesite_id,status_type_id,geometry) VALUES($1,$2,$3::varchar,CASE WHEN $3::varchar='G' THEN '1' ELSE '2' END,$4,(SELECT id FROM gravesite_status_types WHERE code='available'),${geometry})`,[id,cemetery,section,'MR-'+id.slice(0,20)]);
 return{cemetery,g,a,prefix};
}
async function marker(c,grave,id,relationship='primary'){
 const row=(await c.query("INSERT INTO headstones(gravesite_uuid,headstone_id,marker_type_id) VALUES($1,$2,(SELECT id FROM marker_types WHERE code='flat_marker')) RETURNING id,headstone_id",[grave,id])).rows[0];
 await c.query('INSERT INTO headstone_gravesites(headstone_uuid,gravesite_uuid,relationship_type) VALUES($1,$2,$3)',[row.id,grave,relationship]);return row;
}
const flush=async c=>{await c.query('SET CONSTRAINTS ALL IMMEDIATE');await c.query('SET CONSTRAINTS ALL DEFERRED');};
async function rejected(c,run,code){
 await c.query('SAVEPOINT rejected_marker');
 try{await assert.rejects(async()=>{await run();await flush(c);},err=>err.code===code);}
 finally{await c.query('ROLLBACK TO SAVEPOINT rejected_marker');await c.query('RELEASE SAVEPOINT rejected_marker');}
}
test('automatic marker IDs reserve historical numbers and Section G preserves one primary across links and restores',async()=>{
 const c=new pg.Client(config);await c.connect();
 try{
  await c.query('BEGIN');const f=await fixture(c);
  await marker(c,f.a,f.prefix+'0009');const retired=await marker(c,f.a,f.prefix+'0010');
  await c.query('UPDATE headstones SET deleted_at=now() WHERE id=$1',[retired.id]);await flush(c);
  await c.query('SET LOCAL ROLE cemetery_api');
  assert.equal((await c.query("SELECT has_table_privilege(current_user,'section_g_primary_marker_claims','INSERT') AS allowed")).rows[0].allowed,false);
  const first=await marker(c,f.g,null);assert.equal(first.headstone_id,f.prefix+'0011');await flush(c);
  await rejected(c,()=>marker(c,f.a,f.prefix+'0009'),'23505');
  await rejected(c,()=>marker(c,f.g,null),'23514');
  await rejected(c,()=>marker(c,f.g,null,'spans'),'23514');
  const secondary=await marker(c,f.g,null,'secondary');await flush(c);
  await rejected(c,()=>c.query("UPDATE headstone_gravesites SET relationship_type='primary' WHERE headstone_uuid=$1",[secondary.id]),'23514');
  await c.query('UPDATE headstones SET deleted_at=now() WHERE id=$1',[first.id]);await flush(c);
  await c.query("UPDATE headstone_gravesites SET relationship_type='primary' WHERE headstone_uuid=$1",[secondary.id]);await flush(c);
  await rejected(c,()=>c.query('UPDATE headstones SET deleted_at=NULL WHERE id=$1',[first.id]),'23514');
  const linked=await marker(c,f.a,null);await flush(c);
  await c.query("INSERT INTO headstone_gravesites(headstone_uuid,gravesite_uuid,relationship_type,deleted_at) VALUES($1,$2,'primary',now())",[linked.id,f.g]);await flush(c);
  await rejected(c,()=>c.query('UPDATE headstone_gravesites SET deleted_at=NULL WHERE headstone_uuid=$1 AND gravesite_uuid=$2',[linked.id,f.g]),'23514');
  // Moving an ordinary grave with two primary markers into G is also rejected.
  await marker(c,f.a,null);await flush(c);
  await rejected(c,()=>c.query("UPDATE gravesites SET section_id='G' WHERE id=$1",[f.a]),'23514');
  await c.query('RESET ROLE');
  const section=randomUUID();
  await c.query(`INSERT INTO sections(section_id,cemetery_id,name,geometry) VALUES($1,$2,'A',${geometry})`,[section,f.cemetery]);
  await c.query('UPDATE gravesites SET section_uuid=$2 WHERE id=$1',[f.a,section]);await flush(c);
  await rejected(c,()=>c.query("UPDATE sections SET name='G' WHERE section_id=$1",[section]),'23514');
  const other=await fixture(c), code='FMT-'+randomUUID().slice(0,8)+'-';
  await marker(c,other.a,code+'009');
  assert.equal((await marker(c,other.g,null)).headstone_id,code+'010');await flush(c);
  const fresh=await fixture(c);
  assert.match((await marker(c,fresh.g,null)).headstone_id,/^MR[0-9A-F]-HS-[0-9]{4}$/);await flush(c);
  // A legacy direct reference, without an explicit link, still counts as primary.
  await rejected(c,()=>c.query("INSERT INTO headstones(gravesite_uuid,headstone_id,marker_type_id) VALUES($1,$2,(SELECT id FROM marker_types WHERE code='flat_marker'))",[f.g,f.prefix+'LEGACY']),'23514');
 }finally{await c.query('ROLLBACK');await c.end();}
});

test('concurrent automatic creation allocates different IDs and cannot commit two Section G primaries',async()=>{
 const setup=new pg.Client(config),one=new pg.Client(config),two=new pg.Client(config);await Promise.all([setup.connect(),one.connect(),two.connect()]);
 let f;const created=[];
 try{
  f=await fixture(setup);const seed=await marker(setup,f.a,f.prefix+'0001');created.push(seed.id);
  await one.query('BEGIN');await two.query('BEGIN');
  const a=await marker(one,f.a,null);created.push(a.id);
  const waiting=marker(two,f.a,null);await one.query('COMMIT');const b=await waiting;created.push(b.id);await two.query('COMMIT');
  assert.notEqual(a.headstone_id,b.headstone_id);
  await one.query('BEGIN');await two.query('BEGIN');
  const primary=await marker(one,f.g,null);created.push(primary.id);
  const second=marker(two,f.g,null);await one.query('COMMIT');await second;
  await assert.rejects(two.query('COMMIT'),err=>err.code==='23514');await two.query('ROLLBACK');
  assert.equal(Number((await setup.query('SELECT count(*) FROM section_g_primary_marker_claims WHERE gravesite_uuid=$1',[f.g])).rows[0].count),1);
 }finally{
  await Promise.all([one.query('ROLLBACK'),two.query('ROLLBACK')]);
  try { if(f){await setup.query('BEGIN');await setup.query('DELETE FROM monument_inspections WHERE headstone_uuid=ANY($1::uuid[])',[created]);await setup.query('DELETE FROM headstones WHERE id=ANY($1::uuid[])',[created]);await setup.query('DELETE FROM gravesites WHERE cemetery_id=$1',[f.cemetery]);await setup.query('DELETE FROM cemeteries WHERE id=$1',[f.cemetery]);await setup.query('COMMIT');} } finally { await Promise.all([setup.end(),one.end(),two.end()]); }
 }
});


test('repeatable-read link writers cannot commit conflicting primary claims',async()=>{
 const setup=new pg.Client(config),one=new pg.Client(config),two=new pg.Client(config);await Promise.all([setup.connect(),one.connect(),two.connect()]);
 let f;const created=[];
 try{
  f=await fixture(setup);
  const a=await marker(setup,f.g,f.prefix+'0001','secondary'),b=await marker(setup,f.g,f.prefix+'0002','secondary');created.push(a.id,b.id);
  await one.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await two.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  await one.query("UPDATE headstone_gravesites SET relationship_type='primary' WHERE headstone_uuid=$1",[a.id]);
  await two.query("UPDATE headstone_gravesites SET relationship_type='primary' WHERE headstone_uuid=$1",[b.id]);
  await one.query('COMMIT');
  await assert.rejects(two.query('COMMIT'),err=>['40001','23514'].includes(err.code));
  await two.query('ROLLBACK');
  assert.equal(Number((await setup.query("SELECT count(*) FROM headstone_gravesites WHERE gravesite_uuid=$1 AND relationship_type='primary' AND deleted_at IS NULL",[f.g])).rows[0].count),1);
 }finally{
  await Promise.all([one.query('ROLLBACK'),two.query('ROLLBACK')]);
  try {if(f){await setup.query('BEGIN');await setup.query('DELETE FROM monument_inspections WHERE headstone_uuid=ANY($1::uuid[])',[created]);await setup.query('DELETE FROM headstones WHERE id=ANY($1::uuid[])',[created]);await setup.query('DELETE FROM gravesites WHERE cemetery_id=$1',[f.cemetery]);await setup.query('DELETE FROM cemeteries WHERE id=$1',[f.cemetery]);await setup.query('COMMIT');}}
  finally{await Promise.all([setup.end(),one.end(),two.end()]);}
 }
});
