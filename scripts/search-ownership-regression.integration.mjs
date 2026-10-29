import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
import {searchCemetery} from '../server/cemeterySearch.mjs';

test('batched search preserves ownership visibility, status, reasons, scoping and pagination',async()=>{
 const cfg=loadApiConfig();assert.equal(cfg.appEnv,'test');const c=new pg.Client(integrationAdminDatabase(cfg));await c.connect();
 try{await c.query('BEGIN');
 for(const t of ['cemeteries','gravesites','lots','burials','owners','headstones','headstone_gravesites'])await c.query(`CREATE TEMP TABLE ${t}(LIKE public.${t} INCLUDING DEFAULTS) ON COMMIT DROP`);
 await c.query('CREATE TEMP TABLE current_ownership_right_owners(target_type text,lot_uuid uuid,gravesite_uuid uuid,display_name text,effective_date date) ON COMMIT DROP');
 const cemetery=randomUUID(),other=randomUUID(),lot=randomUUID(),direct=randomUUID();
 await c.query(`INSERT INTO cemeteries(id,name,facility_id,geometry) VALUES($1,'Fixture cemetery','SEARCH',ST_Multi(ST_MakeEnvelope(0,0,1,1,4326))),($2,'Other cemetery','OTHER',ST_Multi(ST_MakeEnvelope(0,0,1,1,4326)))`,[cemetery,other]);
 await c.query(`INSERT INTO lots(id,cemetery_id,facility_id,section_id,lot_id,name,geometry) VALUES($1,$2,'SEARCH','A','1','Fixture lot',ST_Multi(ST_MakeEnvelope(0,0,1,1,4326)))`,[lot,cemetery]);
 for(const [i,id,lotId,status] of [[1,direct,null,'available'],[2,randomUUID(),lot,'available'],[3,randomUUID(),null,'available'],[4,randomUUID(),null,'needs_review']])await c.query(`INSERT INTO gravesites(id,cemetery_id,section_id,grave_id,gravesite_id,lot_uuid,status_type_id,geometry) VALUES($1,$2,'A',$3,$4,$5,(SELECT id FROM gravesite_status_types WHERE code=$6),ST_Multi(ST_MakeEnvelope(0,0,1,1,4326)))`,[id,cemetery,String(i),'FIXTURE-'+i,lotId,status]);
 await c.query(`INSERT INTO gravesites(cemetery_id,section_id,grave_id,gravesite_id,status_type_id,geometry) VALUES($1,'A','5','OTHER-5',(SELECT id FROM gravesite_status_types WHERE code='available'),ST_Multi(ST_MakeEnvelope(0,0,1,1,4326)))`,[other]);
 await c.query(`INSERT INTO current_ownership_right_owners VALUES('gravesite',NULL,$1,'Private Fixture Owner','1965-11-14'),('gravesite',NULL,$1,'Private Fixture Owner','1965-11-14'),('lot',$2,NULL,'Whole Lot Owner','1970-01-01')`,[direct,lot]);
 for(const options of [{includeOwnership:false},{includeOwnership:true,ownershipCemeteryIds:[]},{includeOwnership:true,ownershipCemeteryIds:[other]}]){
  assert.deepEqual(await searchCemetery(c,{cemeteryId:cemetery,query:'Private',...options}),[]);
  assert.deepEqual(await searchCemetery(c,{cemeteryId:cemetery,query:'1965',...options}),[]);
 }
 const owner=await searchCemetery(c,{cemeteryId:cemetery,query:'Private',includeOwnership:true,ownershipCemeteryIds:[cemetery]});
 assert.equal(owner.length,1);assert.equal(owner[0].grave.id,'FIXTURE-1');assert.equal(owner[0].grave.status,'sold');assert.deepEqual(owner[0].reasons,['Owner: Private Fixture Owner']);
 const dates=await searchCemetery(c,{cemeteryId:cemetery,query:'1965',includeOwnership:true,ownershipCemeteryIds:[cemetery]});assert.equal(dates.length,1);assert.deepEqual(dates[0].reasons,['Ownership date: 1965-11-14']);
 const sold=await searchCemetery(c,{cemeteryId:cemetery,query:'',statuses:['sold'],includeOwnership:false});assert.deepEqual(sold.map(m=>m.grave.id).sort(),['FIXTURE-1','FIXTURE-2']);
 const all=await searchCemetery(c,{cemeteryId:cemetery,query:'Fixture',includeOwnership:false});assert.equal(all.length,4);
 const page=await searchCemetery(c,{cemeteryId:cemetery,query:'Fixture',includeOwnership:false,limit:1,offset:1});assert.deepEqual(page,all.slice(1,3));
 assert.ok(all.every(m=>m.grave.cemeteryId===cemetery));
 }finally{await c.query('ROLLBACK');await c.end();}
});
