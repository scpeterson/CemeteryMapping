import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
import {updateGraveLotAssignment} from '../server/cemeteryGraveMutations.mjs';
import {BadRequestError,ConflictError} from '../server/requestValidation.mjs';

test('lot assignment distinguishes A-8 from B-8, rejects ambiguity, preserves restrictions and unlinks safely',async()=>{
 const config=loadApiConfig();const c=new pg.Client(integrationAdminDatabase(config));await c.connect();
 const pool={connect:async()=>({release(){},query:(sql,values)=>c.query(sql==='BEGIN'?'SAVEPOINT lot_assignment':sql==='COMMIT'?'RELEASE SAVEPOINT lot_assignment':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT lot_assignment':sql,values)})};
 try{
  await c.query('BEGIN');const suffix=randomUUID().slice(0,8);
  const geom='MULTIPOLYGON(((0 0,0.001 0,0.001 0.001,0 0.001,0 0)))';
  const cemetery=(await c.query('INSERT INTO cemeteries(name,facility_id,geometry) VALUES($1,$2,ST_GeomFromText($3,4326)) RETURNING id',[`Lot regression ${suffix}`,suffix,geom])).rows[0].id;
  const sections={};for(const name of ['A','B'])sections[name]=(await c.query('INSERT INTO sections(cemetery_id,name,facility_id,geometry) VALUES($1,$2,$3,ST_GeomFromText($4,4326)) RETURNING section_id',[cemetery,name,suffix,geom])).rows[0].section_id;
  const lots={};for(const section of ['A','B'])lots[section]=(await c.query(`INSERT INTO lots(cemetery_id,section_uuid,facility_id,section_id,lot_id,name,burial_use_status,geometry)
   VALUES($1,$2,$3,$4,'8',$5,$6,ST_GeomFromText($7,4326)) RETURNING id`,[cemetery,sections[section],suffix,section,`${section}-8`,section==='A'?'non_burial':'standard',geom])).rows[0].id;
  const grave=`B-0089-${suffix}`;
  await c.query(`INSERT INTO gravesites(cemetery_id,section_uuid,facility_id,section_id,grave_id,gravesite_id,status_type_id,geometry)
   VALUES($1,$2,$3,'B','0089',$4,(SELECT id FROM gravesite_status_types WHERE code='available'),ST_GeomFromText($5,4326))`,[cemetery,sections.B,suffix,grave,geom]);
  const state=async()=>(await c.query('SELECT lot_uuid,lot_id,section_id,section_uuid FROM gravesites WHERE cemetery_id=$1 AND gravesite_id=$2',[cemetery,grave])).rows[0];
  const before=await state();
  assert.equal(await updateGraveLotAssignment(pool,cemetery,grave,'8',{lotUuid:lots.B,allowedCemeteryIds:[]}),undefined);
  await assert.rejects(updateGraveLotAssignment(pool,cemetery,grave,'8'),BadRequestError);
  assert.deepEqual(await state(),before);
  assert.deepEqual(await updateGraveLotAssignment(pool,cemetery,grave,'8',{lotUuid:randomUUID()}),{invalid:'lot_not_found'});
  assert.deepEqual(await updateGraveLotAssignment(pool,cemetery,grave,'8',{lotUuid:lots.B}),{id:grave,lotId:'8',section:'B'});
  const assigned=await state();assert.equal(assigned.lot_uuid,lots.B);assert.equal(assigned.section_uuid,sections.B);
  await assert.rejects(updateGraveLotAssignment(pool,cemetery,grave,'8',{lotUuid:lots.A}),error=>error instanceof ConflictError&&error.message.includes('A-8'));
  assert.deepEqual(await state(),assigned);
  const restricted=(await c.query(`INSERT INTO lot_restricted_areas(lot_uuid,name,geometry) VALUES($1,'Test prohibited area',ST_GeomFromText($2,4326)) RETURNING id`,[lots.B,geom])).rows[0].id;
  await assert.rejects(updateGraveLotAssignment(pool,cemetery,grave,'8',{lotUuid:lots.B}),error=>error instanceof ConflictError&&error.message.includes('overlaps prohibited lot area'));
  assert.deepEqual(await state(),assigned);
  await c.query('DELETE FROM lot_restricted_areas WHERE id=$1',[restricted]);
  // Capacity errors keep the target unassigned and expose a useful conflict,
  // while re-saving a grave already in a full lot must remain valid.
  const capacityIds=[];
  for(let i=0;i<4;i+=1){
   const id=`capacity-${i}-${suffix}`;capacityIds.push(id);
   await c.query(`INSERT INTO gravesites(cemetery_id,section_uuid,facility_id,section_id,grave_id,gravesite_id,lot_uuid,status_type_id,geometry)
    VALUES($1,$2,$3,'B',$7,$4,$5,(SELECT id FROM gravesite_status_types WHERE code='available'),ST_GeomFromText($6,4326))`,[cemetery,sections.B,suffix,id,lots.B,geom,`C${i}`]);
  }
  assert.deepEqual(await updateGraveLotAssignment(pool,cemetery,grave,'8',{lotUuid:lots.B}),{id:grave,lotId:'8',section:'B'});
  const sixth=`sixth-${suffix}`;
  await c.query(`INSERT INTO gravesites(cemetery_id,section_uuid,facility_id,section_id,grave_id,gravesite_id,status_type_id,geometry)
   VALUES($1,$2,$3,'B','0006',$4,(SELECT id FROM gravesite_status_types WHERE code='available'),ST_GeomFromText($5,4326))`,[cemetery,sections.B,suffix,sixth,geom]);
  await assert.rejects(updateGraveLotAssignment(pool,cemetery,sixth,'8',{lotUuid:lots.B}),error=>
   error instanceof ConflictError && error.message==='Lot B-8 already has the maximum of five active gravesites. Review its existing assignments before adding another.');
  assert.equal((await c.query('SELECT lot_uuid FROM gravesites WHERE gravesite_id=$1',[sixth])).rows[0].lot_uuid,null);
  assert.deepEqual(await state(),assigned);
  assert.equal(Number((await c.query('SELECT count(*) FROM gravesites WHERE lot_uuid=$1 AND deleted_at IS NULL',[lots.B])).rows[0].count),5);
  await c.query('UPDATE gravesites SET deleted_at=now() WHERE gravesite_id=$1',[capacityIds[0]]);
  assert.deepEqual(await updateGraveLotAssignment(pool,cemetery,sixth,'8',{lotUuid:lots.B}),{id:sixth,lotId:'8',section:'B'});
  const crossSection=(await c.query(`INSERT INTO lots(cemetery_id,section_uuid,facility_id,section_id,lot_id,name,geometry) VALUES($1,$2,$3,'A','42','A-42',ST_GeomFromText($4,4326)) RETURNING id`,[cemetery,sections.A,suffix,geom])).rows[0].id;
  assert.deepEqual(await updateGraveLotAssignment(pool,cemetery,grave,'42'),{id:grave,lotId:'42',section:'A'});
  assert.equal((await state()).lot_uuid,crossSection);assert.equal((await state()).section_uuid,sections.A);
  await updateGraveLotAssignment(pool,cemetery,grave,'8',{lotUuid:lots.B});
  assert.deepEqual(await updateGraveLotAssignment(pool,cemetery,grave,''),{id:grave,lotId:'',section:'B'});
  assert.deepEqual(await state(),before);
 }finally{await c.query('ROLLBACK');await c.end();}
});
