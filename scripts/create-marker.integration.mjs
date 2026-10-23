import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {createHeadstoneForGrave} from '../server/cemeteryHeadstoneMutations.mjs';
import {validateCreateHeadstonePayload} from '../server/routes/cemeteryRouteValidation.mjs';

test('new marker creation persists provenance and creates its own Front face and inspection',async()=>{
 const config=loadApiConfig();assert.equal(config.appEnv,'test');
 const c=new pg.Client(config.database);await c.connect();
 const nested={connect:async()=>({release(){},query:(sql,params)=>c.query(sql==='BEGIN'?'SAVEPOINT marker_create':sql==='COMMIT'?'RELEASE SAVEPOINT marker_create':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT marker_create':sql,params)})};
 try{
  await c.query('BEGIN');
  const target=(await c.query(`SELECT h.marker_type_id,h.marker_scope_type_id,h.material_type_id,h.condition_type_id,g.gravesite_id,g.cemetery_id
   FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid WHERE h.deleted_at IS NULL AND g.deleted_at IS NULL LIMIT 1`)).rows[0];assert.ok(target);
  for(const supplied of [false,true]){
   const payload=validateCreateHeadstonePayload({headstoneId:`REGRESSION-${randomUUID()}`,markerTypeId:target.marker_type_id,markerScopeId:target.marker_scope_type_id,
    materialId:target.material_type_id,conditionId:target.condition_type_id,inscription:'New marker reading',lastInspectedAt:'2026-10-23',
    relationshipType:'secondary',reason:'Regression test marker creation',...(supplied?{nhgInclusion:'not_listed',provenanceVerificationSource:'field_survey',provenanceVerifiedAt:'2026-10-23'}:{})},target.gravesite_id);
   const created=await createHeadstoneForGrave(nested,target.cemetery_id,target.gravesite_id,payload,{actorUser:{role:'admin'}});assert.ok(created?.id);
   const saved=(await c.query('SELECT * FROM headstones WHERE id=$1',[created.id])).rows[0];
   assert.deepEqual(saved.source_properties.NormalizedProvenance,{nhgInclusion:supplied?'not_listed':'not_checked',verificationSourceType:supplied?'field_survey':'manual_review',verifiedAt:supplied?'2026-10-23':null});
   assert.equal(saved.faces.length,1);assert.equal(saved.faces[0].label,'Front');assert.equal(saved.faces[0].inscription,'New marker reading');
   const visits=(await c.query('SELECT * FROM monument_inspections WHERE headstone_uuid=$1',[created.id])).rows;
   assert.equal(visits.length,1);assert.equal(visits[0].source_type,'field_survey');assert.equal(visits[0].faces[0].id,saved.faces[0].id);
  }
 }finally{await c.query('ROLLBACK');await c.end();}
});
