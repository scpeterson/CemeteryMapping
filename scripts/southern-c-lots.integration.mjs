import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
const sql=await readFile(new URL('../db/changelog/changes/504-shift-southern-c-lots.sql',import.meta.url),'utf8');
async function fixture(run){
 const cfg=loadApiConfig();assert.equal(cfg.appEnv,'test');const c=new pg.Client(integrationAdminDatabase(cfg));await c.connect();
 try{await c.query('BEGIN');
 await c.query(`CREATE TEMP TABLE lots (LIKE public.lots INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP;
 ALTER TABLE lots ADD COLUMN IF NOT EXISTS area_type text DEFAULT 'lot';
 CREATE TEMP TABLE cemeteries(id uuid DEFAULT gen_random_uuid(),facility_id text,geometry geometry(MultiPolygon,4326),deleted_at timestamptz) ON COMMIT DROP;
 CREATE TEMP TABLE sections(cemetery_id uuid,name text,geometry geometry(MultiPolygon,4326),deleted_at timestamptz) ON COMMIT DROP;
 CREATE TEMP TABLE gravesites(id uuid DEFAULT gen_random_uuid(),cemetery_id uuid,lot_uuid uuid,deleted_at timestamptz) ON COMMIT DROP;
 CREATE TEMP TABLE headstones(headstone_id text,gravesite_uuid uuid,geometry geometry(Point,4326),deleted_at timestamptz) ON COMMIT DROP;
 CREATE TEMP TABLE ownership_event_rights(lot_uuid uuid) ON COMMIT DROP;
 CREATE TEMP TABLE lot_ownership_events(lot_uuid uuid) ON COMMIT DROP;
 CREATE TEMP TABLE lot_restricted_areas(lot_uuid uuid,deleted_at timestamptz) ON COMMIT DROP;
 INSERT INTO cemeteries(facility_id,geometry) VALUES('1',ST_Multi(ST_MakeEnvelope(-80.08065,40.60102,-80.0799,40.6015,4326)));
 INSERT INTO sections SELECT id,'C',geometry,NULL FROM cemeteries;
 INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,name,burial_use_status,width_feet,length_feet,geometry)
 SELECT c.id,'1','C',v.label,'C-'||v.label,CASE WHEN v.label IN('85','90') THEN 'non_burial' ELSE 'standard' END,10,20,
 ST_Multi(ST_MakeEnvelope(-80.08066+v.col*.000036,40.601066+v.row*.000055,-80.08066+(v.col+1)*.000036,40.601066+(v.row+1)*.000055,4326))
 FROM cemeteries c CROSS JOIN (SELECT (85-i)::text label,i col,0 row FROM generate_series(0,15) i UNION ALL SELECT CASE WHEN i<5 THEN (90-i)::text ELSE (36+i)::text END,i,1 FROM generate_series(0,15) i) v;
 INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,name,area_type,geometry)
 SELECT id,'1','C','P03','C-P03','passageway',ST_Multi(ST_MakeEnvelope(-80.08065,40.601176,-80.080084,40.601203,4326)) FROM cemeteries;
 INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,name,geometry)
 SELECT id,'1','C','OTHER','Unchanged',ST_Multi(ST_MakeEnvelope(-80.0803,40.6013,-80.08029,40.60131,4326)) FROM cemeteries;
 INSERT INTO gravesites(cemetery_id,lot_uuid) SELECT cemetery_id,id FROM lots WHERE lot_id IN('80','82','71');
 INSERT INTO ownership_event_rights SELECT id FROM lots WHERE lot_id='71';
 INSERT INTO headstones SELECT 'TLC-HS-0330',g.id,ST_SetSRID(ST_MakePoint(-80.080462,40.601065),4326),NULL FROM gravesites g JOIN lots l ON l.id=g.lot_uuid WHERE l.lot_id='80';
 INSERT INTO headstones SELECT 'TLC-HS-0361',g.id,ST_SetSRID(ST_MakePoint(-80.080534,40.601063),4326),NULL FROM gravesites g JOIN lots l ON l.id=g.lot_uuid WHERE l.lot_id='82'`);
 await run(c);
 }finally{await c.query('ROLLBACK');await c.end();}
}
test('32 lots shift together, two non-burial lots clip, and C-P03 expands with protected records fixed',()=>fixture(async c=>{
 await c.query('CREATE TEMP TABLE before_lots AS SELECT * FROM lots');
 const protectedBefore=(await c.query('SELECT to_jsonb(h) data FROM headstones h ORDER BY headstone_id')).rows;
 const graves=(await c.query('SELECT to_jsonb(g) data FROM gravesites g ORDER BY id')).rows;
 await c.query(sql);
 const rows=(await c.query(`SELECT l.lot_id,to_jsonb(l) saved,to_jsonb(b) original,
 ST_YMin(Box2D(l.geometry))-ST_YMin(Box2D(b.geometry)) dy,
 ST_HausdorffDistance(l.geometry,ST_Translate(b.geometry,0,ST_YMin(Box2D(l.geometry))-ST_YMin(Box2D(b.geometry)))) shape_error,
 ST_Area(l.geometry::geography)<ST_Area(b.geometry::geography) smaller
 FROM lots l JOIN before_lots b USING(id) ORDER BY l.lot_id`)).rows;
 let moved=0;const deltas=[];
 for(const r of rows){
  if(r.lot_id==='OTHER'){assert.deepEqual(r.saved,r.original);continue;}
  for(const k of Object.keys(r.original).filter(k=>!['geometry','geometry_source','geometry_notes','updated_at'].includes(k)))assert.deepEqual(r.saved[k],r.original[k],k);
  if(r.lot_id==='P03')continue;
  moved++;assert.ok(r.dy<0);deltas.push(r.dy);
  if(['85','90'].includes(r.lot_id)){assert.ok(r.smaller);assert.equal(r.saved.burial_use_status,'non_burial');}else assert.ok(r.shape_error<1e-11);
 }
 assert.equal(moved,32);assert.ok(Math.max(...deltas)-Math.min(...deltas)<1e-12);
 assert.deepEqual((await c.query('SELECT to_jsonb(h) data FROM headstones h ORDER BY headstone_id')).rows,protectedBefore);
 assert.deepEqual((await c.query('SELECT to_jsonb(g) data FROM gravesites g ORDER BY id')).rows,graves);
 const checks=(await c.query(`SELECT ST_CoveredBy(b.geometry,ST_Buffer(p.geometry,1e-12)) expands,
 ST_YMax(Box2D(p.geometry))=ST_YMax(Box2D(b.geometry)) north_fixed,
 (SELECT bool_and(ST_ContainsProperly(l.geometry,h.geometry)) FROM lots l JOIN headstones h ON h.headstone_id=CASE l.lot_id WHEN '80' THEN 'TLC-HS-0330' ELSE 'TLC-HS-0361' END WHERE l.lot_id IN('80','82')) contains_markers,
 (SELECT count(*) FROM lots l WHERE l.lot_id<>'P03' AND ST_Area(ST_Intersection(l.geometry,p.geometry)::geography)>.000001) overlaps_count
 FROM lots p JOIN before_lots b USING(id) WHERE p.lot_id='P03'`)).rows[0];
 assert.ok(checks.expands&&checks.north_fixed&&checks.contains_markers);assert.equal(checks.overlaps_count,'0');
}));
for(const [name,change,pattern] of [
 ['missing lot',"DELETE FROM lots WHERE lot_id='41'",/all 32/],
 ['missing passageway',"DELETE FROM lots WHERE lot_id='P03'",/requires C-P03/],
 ['missing marker',"DELETE FROM headstones WHERE headstone_id='TLC-HS-0361'",/both fixed monuments/],
 ['marker cannot fit',"UPDATE headstones SET geometry=ST_Translate(geometry,.001,0)",/contain both fixed/],
 ['unexpected standard C-85',"UPDATE lots SET burial_use_status='standard' WHERE lot_id='85'",/must remain non-burial/],
 ['C-85 ownership',"INSERT INTO ownership_event_rights SELECT id FROM lots WHERE lot_id='85'",/free of grave or ownership/],
 ['attached restriction',"INSERT INTO lot_restricted_areas SELECT id,NULL FROM lots WHERE lot_id='71'",/no attached restricted/],
 ['overlapping neighbor',"UPDATE lots SET geometry=(SELECT geometry FROM lots WHERE lot_id='75') WHERE lot_id='OTHER'",/not overlap other/],
 ['detached passageway',"UPDATE lots SET geometry=ST_Translate(geometry,0,.00001) WHERE lot_id='P03'",/directly above/],
])test(`southern C shift refuses ${name}`,()=>fixture(async c=>{await c.query(change);await assert.rejects(c.query(sql),pattern);}));
