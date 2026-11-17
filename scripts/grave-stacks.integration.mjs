import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {loadDbEnvironment} from './lib/run-liquibase.mjs';
import {saveGraveStack,validateGraveStack} from '../server/graveStacks.mjs';
import {selectGravesForCemeteries} from '../server/cemeteryMapQueries.mjs';
import {toGraveSummary} from '../server/cemeteryGraveQueries.mjs';

test('stacking constraints, cutoff and historical reservations preserve graves, geometry, burials and markers',async()=>{
 const e=loadDbEnvironment('test');
 const c=new pg.Client({host:'127.0.0.1',port:Number(e.POSTGRES_PORT),database:e.POSTGRES_DB,user:e.POSTGRES_USER,password:e.POSTGRES_PASSWORD});
 await c.connect();
 try{
  await c.query('BEGIN');
  const cemetery=randomUUID(),other=randomUUID(),group=randomUUID(),bottom=randomUUID(),upper=randomUUID();
  const geom="ST_Multi(ST_GeomFromText('POLYGON((-80 40,-79.999 40,-79.999 40.001,-80 40.001,-80 40))',4326))";
  await c.query(`INSERT INTO cemeteries(id,name,geometry,stacking_authorization_cutoff) VALUES($1,'Stack regression',${geom},'2027-03-01'),($2,'Other stack cemetery',${geom},NULL)`,[cemetery,other]);
  await c.query("INSERT INTO grave_stack_groups(id,cemetery_id,name) VALUES($1,$2,'Family stack')",[group,cemetery]);
  for(const [id,num] of [[bottom,1],[upper,2]]) await c.query(`INSERT INTO gravesites(id,cemetery_id,grave_id,gravesite_id,status_type_id,geometry) VALUES($1,$2,$3,$4,(SELECT id FROM gravesite_status_types WHERE code='available'),${geom})`,[id,cemetery,String(num),'STACK-'+id.slice(0,12)]);
  const before=(await c.query('SELECT id,ST_AsEWKB(geometry) AS geometry FROM gravesites WHERE id=ANY($1) ORDER BY id',[[bottom,upper]])).rows;
  const failure=async(sql,values,code)=>{
   await c.query('SAVEPOINT rejected');
   try{await assert.rejects(c.query(sql,values),err=>err.code===code);}finally{await c.query('ROLLBACK TO SAVEPOINT rejected');await c.query('RELEASE SAVEPOINT rejected');}
  };
  await c.query('UPDATE gravesites SET stack_group_uuid=$2,stack_level=1 WHERE id=$1',[bottom,group]);
  await failure('UPDATE gravesites SET stack_group_uuid=$2,stack_level=2 WHERE id=$1',[upper,group],'23514');
  for(const date of ['2027-03-01','2027-03-02']) await failure("UPDATE gravesites SET stack_group_uuid=$2,stack_level=2,stacking_authorized_on=$3,stacking_authorization_reference='Reservation deed' WHERE id=$1",[upper,group,date],'23514');
  await saveGraveStack(c,{uuid:upper,cemetery_id:cemetery},validateGraveStack({stackGroup:'Family stack',stackLevel:2,stackingAuthorizedOn:'2027-02-28',stackingAuthorizationReference:'Earlier deed'}),{role:'admin'});
  await failure('UPDATE gravesites SET stack_level=1 WHERE id=$1',[upper],'23505');
  await failure('UPDATE gravesites SET cemetery_id=$2 WHERE id=$1',[upper,other],'23503');
  await failure('UPDATE gravesites SET stack_group_uuid=NULL WHERE id=$1',[upper],'23514');
  // A later interment is separate from authorization. Updating status/name must
  // continue working even if a later policy change predates that authorization.
  await c.query("UPDATE cemeteries SET stacking_authorization_cutoff='2027-01-01' WHERE id=$1",[cemetery]);
  await c.query("UPDATE gravesites SET name='Reserved for a living person',status_type_id=(SELECT id FROM gravesite_status_types WHERE code='reserved') WHERE id=$1",[upper]);
  const reserved = (await selectGravesForCemeteries(c,[cemetery])).find(row=>row.stack_level===2);
  assert.equal(reserved.status,'reserved'); assert.equal(reserved.stack_top_level,2);
  await c.query(`INSERT INTO burials(gravesite_uuid,full_name,burial_date,interment_type_id,burial_record_status_type_id) VALUES($1,'Historical bottom burial','2020-01-01',(SELECT id FROM burial_interment_types WHERE code='casket'),(SELECT id FROM burial_record_status_types WHERE code='interred')),($2,'Later upper interment','2030-01-01',(SELECT id FROM burial_interment_types WHERE code='casket'),(SELECT id FROM burial_record_status_types WHERE code='interred'))`,[bottom,upper]);
  const occupied=await selectGravesForCemeteries(c,[cemetery]);
  assert.equal(occupied.length,2);assert.ok(occupied.every(row=>row.status==='occupied' && row.stack_top_level===2));
  const marker=randomUUID();
  const template=(await c.query('SELECT marker_type_id,marker_scope_type_id,material_type_id,condition_type_id,geometry FROM headstones WHERE deleted_at IS NULL LIMIT 1')).rows[0];
  assert.ok(template);
  await c.query('INSERT INTO headstones(id,headstone_id,gravesite_uuid,marker_type_id,marker_scope_type_id,material_type_id,condition_type_id,geometry) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[marker,'STACK-'+marker,bottom,template.marker_type_id,template.marker_scope_type_id,template.material_type_id,template.condition_type_id,template.geometry]);
  await c.query("INSERT INTO headstone_gravesites(headstone_uuid,gravesite_uuid,relationship_type) VALUES($1,$2,'spans'),($1,$3,'spans') ON CONFLICT(headstone_uuid,gravesite_uuid) DO NOTHING",[marker,bottom,upper]);
  assert.equal((await c.query('SELECT count(*)::int AS n FROM headstone_gravesites WHERE headstone_uuid=$1 AND deleted_at IS NULL',[marker])).rows[0].n,2);
  assert.equal((await c.query('SELECT count(DISTINCT gravesite_uuid)::int AS n FROM burials WHERE gravesite_uuid=ANY($1)',[[bottom,upper]])).rows[0].n,2);
  assert.deepEqual((await c.query('SELECT id,ST_AsEWKB(geometry) AS geometry FROM gravesites WHERE id=ANY($1) ORDER BY id',[[bottom,upper]])).rows,before);
  const unrestricted=randomUUID();
  await c.query("INSERT INTO grave_stack_groups(id,cemetery_id,name) VALUES($1,$2,'Family stack')",[unrestricted,other]);
  await c.query('UPDATE gravesites SET stack_group_uuid=NULL,stack_level=NULL WHERE id=$1',[bottom]);
  await c.query("UPDATE gravesites SET cemetery_id=$2,stack_group_uuid=$3,stack_level=2,stacking_authorized_on='2028-01-01',stacking_authorization_reference='Other cemetery authorization' WHERE id=$1",[bottom,other,unrestricted]);
  const summary=toGraveSummary({gravesite_id:'g',cemetery_id:cemetery,stack_group:'Family stack',stack_level:2,geometry:{type:'MultiPolygon',coordinates:[]}});
  assert.equal(summary.stackGroup,'Family stack');assert.equal(summary.stackLevel,2);
 }finally{await c.query('ROLLBACK');await c.end();}
});
