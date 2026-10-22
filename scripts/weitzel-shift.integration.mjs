import {createLegacyTableFixture} from "./lib/legacy-table-fixtures.mjs";
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
const sql=await readFile(new URL('../db/changelog/changes/460-shift-weitzel-pair-east-south.sql',import.meta.url),'utf8');
test('owner correction translates only Weitzel monument and pair and preserves links/history',async()=>{
 const c=new pg.Client(integrationAdminDatabase(loadApiConfig()));await c.connect();
 try{await c.query('BEGIN');
 for(const t of ['headstones','gravesites','headstone_gravesites'])await createLegacyTableFixture(c, t);
 const {rows:graves}=await c.query(`INSERT INTO gravesites(cemetery_id,section_id,grave_id,gravesite_id,name,status_type_id,geometry)
 SELECT '11111111-1111-4111-8111-111111111111'::uuid,'D',v.g,v.p,v.n,gen_random_uuid(),ST_Multi(ST_MakeEnvelope(-80.080551,40.60160,-80.080515,40.60161,4326))
 FROM (VALUES('0577','TLC-GPS-0577','Jerry Lee Weitzel'),('0577A','TLC-GPS-0577-01','Shirley Jane Weitzel'),('0554','TLC-GPS-0554','Martha E Traut'))v(g,p,n) RETURNING *`);
 const {rows:[m]}=await c.query(`INSERT INTO headstones(headstone_id,marker_type_id,material_type_id,condition_type_id,geometry,data_confidence)
 VALUES('TLC-HS-0577',gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),ST_SetSRID(ST_MakePoint(-80.0805510637,40.6016128946),4326),'low') RETURNING *`);
 for(const g of graves.slice(0,2))await c.query("INSERT INTO headstone_gravesites(headstone_uuid,gravesite_uuid,relationship_type)VALUES($1,$2,'spans')",[m.id,g.id]);
 const links=(await c.query('SELECT * FROM headstone_gravesites ORDER BY id')).rows;
 await c.query(sql);
 assert.deepEqual((await c.query('SELECT * FROM headstone_gravesites ORDER BY id')).rows,links);
 assert.deepEqual((await c.query('SELECT * FROM gravesites WHERE id=$1',[graves[2].id])).rows,[graves[2]]);
 const {rows:[check]}=await c.query(`SELECT ST_Distance(geometry::geography,ST_Project(ST_Project($1::geography,8*0.3048,pi()/2),0.3048,pi())) err,source_properties FROM headstones WHERE id=$2`,[m.geometry,m.id]);assert.ok(check.err<0.001);assert.equal(check.source_properties.EstimatedPosition.westOffsetFeet,0);
 for(const g of graves.slice(0,2)){
  const {rows:[after]}=await c.query(`SELECT ST_XMin(geometry)-ST_XMin($1::geometry) dx,ST_YMin(geometry)-ST_YMin($1::geometry) dy,geometry_notes FROM gravesites WHERE id=$2`,[g.geometry,g.id]);assert.ok(after.dx>0);assert.ok(after.dy<0);assert.match(after.geometry_notes,/Field review required/);
 }
 }finally{await c.query('ROLLBACK');await c.end();}
});
