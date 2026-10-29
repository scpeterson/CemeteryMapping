import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
import {selectGravesForCemeteries} from '../server/cemeteryMapQueries.mjs';

// Rollback-only fixtures isolate the ownership view so each status precedence is explicit.
test('map status batching preserves precedence, direct and inherited ownership, veteran flags and cemetery scope',async()=>{
 const cfg=loadApiConfig();assert.equal(cfg.appEnv,'test');const c=new pg.Client(integrationAdminDatabase(cfg));await c.connect();
 try{
  await c.query('BEGIN');
  for(const table of ['cemeteries','gravesites','gravesite_status_types','burials','burial_record_status_types','owners'])await c.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS) ON COMMIT DROP`);
  await c.query('CREATE TEMP TABLE current_ownership_right_owners(target_type text,lot_uuid uuid,gravesite_uuid uuid) ON COMMIT DROP');
  await c.query('INSERT INTO gravesite_status_types SELECT * FROM public.gravesite_status_types');
  await c.query('INSERT INTO burial_record_status_types SELECT * FROM public.burial_record_status_types');
  const cemetery=randomUUID(),other=randomUUID(),lot=randomUUID();
  await c.query("INSERT INTO cemeteries(id,name,facility_id,geometry) SELECT v.id,v.name,v.facility,ST_Multi(ST_MakeEnvelope(0,0,1,1,4326)) FROM(VALUES($1::uuid,'Status test','STATUS'),($2::uuid,'Other','OTHER')) v(id,name,facility)",[cemetery,other]);
  const cases=[
   ['needs-review','needs_review','needs_review','interred','grave'],
   ['occupied','available','occupied','interred','grave'],
   ['recorded-sold','sold','sold',null,null],
   ['recorded-reserved','reserved','reserved',null,'grave'],
   ['direct-owner','available','sold',null,'grave'],
   ['lot-owner','available','sold',null,'lot'],
   ['owner-and-preneed','available','sold','pre_need_inscription','grave'],
   ['preneed','available','reserved','pre_need_inscription',null],
   ['available','available','available',null,null],
   ['deleted-burial','available','available','interred-deleted',null],
   ['legacy-owner','available','sold',null,'legacy'],
   ['deleted-legacy','available','available',null,'deleted-legacy'],
  ];
  for(const [name,stored,,burial,owner] of cases){
   const id=randomUUID();
   await c.query(`INSERT INTO gravesites(id,cemetery_id,facility_id,section_id,gravesite_id,name,lot_uuid,status_type_id,grave_id,geometry)
    VALUES($1,$2,'STATUS','A',$3,$3,$4,(SELECT id FROM gravesite_status_types WHERE code=$5),'1',ST_Multi(ST_MakeEnvelope(0,0,0.001,0.001,4326)))`,[id,cemetery,name,owner==='lot'?lot:null,stored]);
   if(burial)await c.query(`INSERT INTO burials(gravesite_uuid,full_name,veteran,burial_record_status_type_id,interment_type_id,deleted_at)
    VALUES($1,'Test burial',' Yes ',(SELECT id FROM burial_record_status_types WHERE code=$2),(SELECT id FROM burial_interment_types WHERE code='casket'),CASE WHEN $3 THEN now() END)`,[id,burial==='interred-deleted'?'interred':burial,burial==='interred-deleted']);
   if(owner==='grave')await c.query("INSERT INTO current_ownership_right_owners VALUES('gravesite',NULL,$1),('gravesite',NULL,$1)",[id]);
   if(owner==='lot')await c.query("INSERT INTO current_ownership_right_owners VALUES('lot',$1,NULL)",[lot]);
   if(owner==='legacy'||owner==='deleted-legacy')await c.query('INSERT INTO owners(gravesite_uuid,owner,deleted_at) VALUES($1,\'Test owner\',CASE WHEN $2 THEN now() END)',[id,owner==='deleted-legacy']);
  }
  await c.query("INSERT INTO gravesites(cemetery_id,facility_id,section_id,gravesite_id,grave_id,geometry,status_type_id) VALUES($1,'OTHER','A','outside-scope','1',ST_Multi(ST_MakeEnvelope(0,0,0.001,0.001,4326)),(SELECT id FROM gravesite_status_types WHERE code='available'))",[other]);
  for(const includeCost of [false,true]){
   const rows=await selectGravesForCemeteries(c,[cemetery],{includeCost});
   assert.equal(rows.length,cases.length,'Duplicate owners must not multiply graves');
   for(const [name,,expected,burial] of cases){const row=rows.find(r=>r.gravesite_id===name);assert.equal(row.status,expected,name);assert.equal(row.has_veteran,Boolean(burial&&burial!=='interred-deleted'),name);}
  }
 }finally{await c.query('ROLLBACK');await c.end();}
});
