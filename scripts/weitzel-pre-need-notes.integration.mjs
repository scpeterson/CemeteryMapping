import {createLegacyTableFixture} from "./lib/legacy-table-fixtures.mjs";
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
const confirmation=await readFile(new URL('../db/changelog/changes/471-confirm-weitzel-burials.sql',import.meta.url),'utf8');
const sql=await readFile(new URL('../db/changelog/changes/472-correct-weitzel-pre-need-notes.sql',import.meta.url),'utf8');
async function fixture(run){
 const c=new pg.Client(integrationAdminDatabase(loadApiConfig()));await c.connect();
 try{await c.query('BEGIN');
 for(const t of ['gravesites','burials','headstones','headstone_gravesites','headstone_burials'])await createLegacyTableFixture(c, t);
 const {rows:[h]}=await c.query(`INSERT INTO headstones(headstone_id,marker_type_id,material_type_id,condition_type_id,geometry,source_properties)
 VALUES('TLC-HS-0577',gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),ST_SetSRID(ST_MakePoint(-80.08,40.60),4326),
 '{"GravesiteAssignments":{"intermentConfirmed":false}}') RETURNING id`);
 for(const [id,pub,name] of [['0577','TLC-GPS-0577','Jerry Lee Weitzel'],['0577A','TLC-GPS-0577-01','Shirley Jane Weitzel']]){
 const {rows:[g]}=await c.query(`INSERT INTO gravesites(cemetery_id,facility_id,section_id,grave_id,gravesite_id,name,status_type_id,geometry)
 VALUES('00000000-0000-0000-0000-000000000001','1','D',$1,$2,$3,(SELECT id FROM gravesite_status_types WHERE code='needs_review'),
 ST_Multi(ST_MakeEnvelope(-80.081,40.60,-80.0809,40.6001,4326))) RETURNING id`,[id,pub,name]);
 await c.query("INSERT INTO headstone_gravesites(headstone_uuid,gravesite_uuid,relationship_type) VALUES($1,$2,'primary')",[h.id,g.id]);
 }
 await c.query(confirmation);
 await run(c);
 }finally{await c.query('ROLLBACK');await c.end();}
}
test('pre-need correction removes false confirmation and preserves geometry and links',async()=>fixture(async c=>{
 const shapes=(await c.query('SELECT id,geometry FROM gravesites ORDER BY id')).rows;
 const markers=(await c.query('SELECT id,geometry FROM headstones ORDER BY id')).rows;
 const links=(await c.query('SELECT * FROM headstone_burials ORDER BY burial_uuid')).rows;
 const {rows:[shirley]}=await c.query("SELECT * FROM burials WHERE full_name='Shirley Jane Weitzel'");
 await c.query(sql);
 const {rows}=await c.query('SELECT b.*,s.code FROM burials b JOIN burial_record_status_types s ON s.id=b.burial_record_status_type_id ORDER BY full_name');
 assert.equal(rows[0].code,'pre_need_inscription');assert.equal(rows[1].code,'interred');
 for(const r of rows){assert.match(r.notes,/his interment is not confirmed/);assert.doesNotMatch(r.notes,/confirmed interment on/);}
 const afterShirley={...rows[1]};delete afterShirley.code;
 afterShirley.notes=shirley.notes;afterShirley.updated_at=shirley.updated_at;assert.deepEqual(afterShirley,shirley);
 assert.equal(rows[0].source_properties.IntermentConfirmation,undefined);
 assert.equal(rows[0].source_properties.IntermentStatus.intermentConfirmed,false);
 assert.deepEqual((await c.query('SELECT id,geometry FROM gravesites ORDER BY id')).rows,shapes);
 assert.deepEqual((await c.query('SELECT id,geometry FROM headstones ORDER BY id')).rows,markers);
 assert.deepEqual((await c.query('SELECT * FROM headstone_burials ORDER BY burial_uuid')).rows,links);
 assert.equal((await c.query("SELECT source_properties->'GravesiteAssignments'->'intermentConfirmed' confirmed FROM headstones")).rows[0].confirmed,false);
}));
test('absent monument leaves records unchanged',async()=>fixture(async c=>{
 await c.query('DELETE FROM headstones');const before=(await c.query('SELECT * FROM burials ORDER BY id')).rows;
 await c.query(sql);assert.deepEqual((await c.query('SELECT * FROM burials ORDER BY id')).rows,before);
}));
