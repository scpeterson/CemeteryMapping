import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
const sql=await readFile(new URL('../db/changelog/changes/471-confirm-weitzel-burials.sql',import.meta.url),'utf8');
async function fixture(run){
 const c=new pg.Client(integrationAdminDatabase(loadApiConfig()));await c.connect();
 try{await c.query('BEGIN');
 for(const t of ['gravesites','burials','headstones','headstone_gravesites','headstone_burials'])await c.query(`CREATE TEMP TABLE ${t}(LIKE public.${t} INCLUDING ALL) ON COMMIT DROP`);
 const {rows:[h]}=await c.query(`INSERT INTO headstones(headstone_id,marker_type_id,material_type_id,condition_type_id,geometry,source_properties)
 VALUES('TLC-HS-0577',gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),ST_SetSRID(ST_MakePoint(-80.08,40.60),4326),
 '{"GravesiteAssignments":{"intermentConfirmed":false}}') RETURNING id`);
 for(const [id,pub,name] of [['0577','TLC-GPS-0577','Jerry Lee Weitzel'],['0577A','TLC-GPS-0577-01','Shirley Jane Weitzel']]){
 const {rows:[g]}=await c.query(`INSERT INTO gravesites(cemetery_id,facility_id,section_id,grave_id,gravesite_id,name,status_type_id,geometry)
 VALUES('00000000-0000-0000-0000-000000000001','1','D',$1,$2,$3,(SELECT id FROM gravesite_status_types WHERE code='needs_review'),
 ST_Multi(ST_MakeEnvelope(-80.081,40.60,-80.0809,40.6001,4326))) RETURNING id`,[id,pub,name]);
 await c.query("INSERT INTO headstone_gravesites(headstone_uuid,gravesite_uuid,relationship_type) VALUES($1,$2,'primary')",[h.id,g.id]);
 }
 await run(c);
 }finally{await c.query('ROLLBACK');await c.end();}
}
test('confirmed separate burials occupy correct graves and share fixed monument',async()=>fixture(async c=>{
 const before=(await c.query('SELECT id,geometry FROM gravesites ORDER BY id')).rows;
 const marker=(await c.query('SELECT id,geometry FROM headstones')).rows;
 const links=(await c.query('SELECT * FROM headstone_gravesites ORDER BY gravesite_uuid')).rows;
 await c.query(sql);
 const {rows}=await c.query(`SELECT b.full_name,g.grave_id,s.code status,gs.code grave_status,b.birth_date,b.death_date,b.burial_date
 FROM burials b JOIN gravesites g ON g.id=b.gravesite_uuid JOIN burial_record_status_types s ON s.id=b.burial_record_status_type_id
 JOIN gravesite_status_types gs ON gs.id=g.status_type_id ORDER BY g.grave_id`);
 assert.deepEqual(rows.map(r=>[r.full_name,r.grave_id,r.status,r.grave_status]),[
 ['Jerry Lee Weitzel','0577','interred','occupied'],['Shirley Jane Weitzel','0577A','interred','occupied']]);
 for(const r of rows){assert.equal(r.birth_date,null);assert.equal(r.death_date,null);assert.equal(r.burial_date,null);}
 assert.equal((await c.query('SELECT count(*)::int n FROM headstone_burials')).rows[0].n,2);
 assert.deepEqual((await c.query('SELECT id,geometry FROM gravesites ORDER BY id')).rows,before);
 assert.deepEqual((await c.query('SELECT id,geometry FROM headstones')).rows,marker);
 assert.deepEqual((await c.query('SELECT * FROM headstone_gravesites ORDER BY gravesite_uuid')).rows,links);
 assert.equal((await c.query("SELECT source_properties->'GravesiteAssignments'->'intermentConfirmed' confirmed FROM headstones")).rows[0].confirmed,true);
}));
test('existing burial blocks duplication',async()=>fixture(async c=>{
 await c.query("INSERT INTO burials(full_name,last_name,interment_type_id,burial_record_status_type_id) VALUES('Jerry Lee Weitzel','Weitzel',(SELECT id FROM burial_interment_types WHERE code='unknown'),(SELECT id FROM burial_record_status_types WHERE code='unknown'))");
 await assert.rejects(c.query(sql),/Migration 471/);
}));
test('absent monument is a no-op',async()=>fixture(async c=>{
 await c.query('DELETE FROM headstone_gravesites');await c.query('DELETE FROM headstones');await c.query(sql);
 assert.equal((await c.query('SELECT count(*)::int n FROM burials')).rows[0].n,0);
}));
