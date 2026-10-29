import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
const migration=await readFile(new URL('../db/changelog/changes/497-align-section-d-northern-row.sql',import.meta.url),'utf8');
const tops=['53','5','33','TMP14','TMP13'];
const deps=['gravesites','lot_ownership_events','ownership_event_rights','historic_lot_map_gravesite_evidence','lot_restricted_areas'];
async function fixture(run){
 const cfg=loadApiConfig();assert.equal(cfg.appEnv,'test');const c=new pg.Client(integrationAdminDatabase(cfg));await c.connect();
 try{
  await c.query('BEGIN');
  await c.query('CREATE TEMP TABLE lots (LIKE public.lots INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP');
  await c.query('CREATE TEMP TABLE cemeteries(id uuid,geometry geometry(MultiPolygon,4326),deleted_at timestamptz) ON COMMIT DROP');
  for(const t of deps)await c.query(`CREATE TEMP TABLE ${t}(lot_uuid uuid) ON COMMIT DROP`);
  await c.query(`INSERT INTO cemeteries VALUES('00000000-0000-4000-8000-000000000001',ST_Multi(ST_GeomFromText('POLYGON((-80.081 40.6008,-80.0796 40.6008,-80.0796 40.60178,-80.0799 40.6019,-80.081 40.6019,-80.081 40.6008))',4326)),NULL)`);
  await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,width_feet,length_feet,geometry)
   SELECT c.id,'1','D',v.label,16.36,16,ST_Multi(CASE WHEN v.col<3 THEN g.geom ELSE ST_CollectionExtract(ST_Intersection(g.geom,c.geometry),3) END)
   FROM cemeteries c CROSS JOIN(VALUES('53',0),('5',1),('33',2),('TMP14',3),('TMP13',4)) v(label,col)
   CROSS JOIN LATERAL(SELECT ST_MakeEnvelope(-80.08+v.col*0.00006,40.6018,-80.08+(v.col+1)*0.00006,40.601844,4326) geom) g`);
  await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,width_feet,length_feet,geometry)
   SELECT c.id,'1','D',v.label,16.36,16,ST_Multi(ST_MakeEnvelope(-80.07998+v.col*0.00006,40.601736,-80.07998+(v.col+1)*0.00006,40.60178,4326))
   FROM cemeteries c CROSS JOIN(VALUES('54',0),('51',1),('34',2),('32',3),('25',4)) v(label,col)`);
  await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,geometry,deleted_at,delete_reason)
   SELECT id,'1','D','TMP15',ST_Multi(ST_MakeEnvelope(-80.08006,40.6018,-80.08,40.601844,4326)),now(),'defunct' FROM cemeteries`);
  await run(c);
 }finally{await c.query('ROLLBACK');await c.end();}
}
test('five northern lots align east; full nominal temporary footprints are re-clipped and both become non-burial',()=>fixture(async c=>{
 await c.query('CREATE TEMP TABLE before_lots AS SELECT * FROM lots');await c.query(migration);
 const results=(await c.query(`SELECT t.lot_id,t.burial_use_status,ST_CoveredBy(t.geometry,ST_Buffer(c.geometry,1e-12)) inside,
  ST_HausdorffDistance(t.geometry,ST_Multi(ST_CollectionExtract(ST_Intersection(ST_MakeEnvelope(ST_XMin(Box2D(s.geometry)),40.6018,ST_XMax(Box2D(s.geometry)),40.601844,4326),c.geometry),3)))<1e-11 expected
  FROM(VALUES('53','54'),('5','51'),('33','34'),('TMP14','32'),('TMP13','25')) p(a,b)
  JOIN lots t ON t.lot_id=p.a JOIN lots s ON s.lot_id=p.b CROSS JOIN cemeteries c`)).rows;
 assert.equal(results.length,5);for(const r of results){assert.ok(r.inside);assert.ok(r.expected);assert.equal(r.burial_use_status,r.lot_id.startsWith('TMP')?'non_burial':'standard');}
 const extra=['geometry','geometry_source','geometry_notes','updated_at','burial_use_status','burial_use_notes'];
 const all=(await c.query('SELECT to_jsonb(l) saved,to_jsonb(b) original FROM lots l JOIN before_lots b USING(id)')).rows;
 for(const {saved,original} of all){
  if(!tops.includes(saved.lot_id))assert.deepEqual(saved,original);
  else for(const key of Object.keys(original).filter(k=>!extra.includes(k)))assert.deepEqual(saved[key],original[key],key);
 }
 assert.equal((await c.query("SELECT count(*) FROM lots WHERE burial_use_status='non_burial' AND burial_use_notes LIKE '%cannot contain gravesites or monuments%'")).rows[0].count,'2');
}));
for(const [name,sql,pattern] of [
 ['missing anchor',"DELETE FROM lots WHERE lot_id='53'",/D-53 anchor/],
 ['missing southern lot',"DELETE FROM lots WHERE lot_id='25'",/complete five-lot/],
 ['no eastward shift',"UPDATE lots SET geometry=ST_Translate(geometry,-0.00002,0) WHERE lot_id='54'",/move.*east/],
 ['incompatible southern side',"UPDATE lots SET geometry=ST_Translate(geometry,0.00001,0) WHERE lot_id='51'",/side edges/],
 ['incompatible northern row',"UPDATE lots SET geometry=ST_Translate(geometry,0.00001,0) WHERE lot_id='5'",/original adjoining/],
 ['missing boundary',"UPDATE cemeteries SET geometry=NULL",/valid cemetery boundary/],
 ['empty clipped footprint',"UPDATE cemeteries SET geometry=ST_Multi(ST_MakeEnvelope(-80.081,40.60,-80.07974,40.602,4326))",/valid and inside/],
 ['neighboring overlap',"INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,geometry) SELECT cemetery_id,'1','D','OTHER',ST_Translate(geometry,0.000025,0) FROM lots WHERE lot_id='53'",/overlap other/],
])test(`alignment refuses ${name}`,()=>fixture(async c=>{await c.query(sql);await assert.rejects(c.query(migration),pattern);}));
for(const dep of deps)test(`alignment refuses ${dep} dependencies`,()=>fixture(async c=>{
 await c.query(`INSERT INTO ${dep} SELECT id FROM lots WHERE lot_id='TMP13'`);await assert.rejects(c.query(migration),/no.*dependencies/);
}));
test('alignment skips databases without the target row',()=>fixture(async c=>{
 await c.query('DELETE FROM lots WHERE lot_id=ANY($1)',[tops]);await c.query(migration);
 assert.equal((await c.query('SELECT count(*) FROM lots WHERE burial_use_status=\'non_burial\'')).rows[0].count,'0');
}));

test('authorized D-33 corner clipping retains standard use and nominal dimensions',()=>fixture(async c=>{
 await c.query("UPDATE cemeteries SET geometry=ST_Multi(ST_GeomFromText('POLYGON((-80.081 40.6008,-80.0796 40.6008,-80.0796 40.60176,-80.0799 40.60188,-80.081 40.60188,-80.081 40.6008))',4326))");
 await c.query(migration);
 const r=(await c.query("SELECT l.burial_use_status,l.width_feet,l.length_feet,ST_CoveredBy(l.geometry,ST_Buffer(c.geometry,1e-12)) inside,ST_Area(l.geometry)<ST_Area(ST_Envelope(l.geometry)) clipped FROM lots l CROSS JOIN cemeteries c WHERE lot_id='33'")).rows[0];
 assert.equal(r.burial_use_status,'standard');assert.ok(r.inside&&r.clipped);assert.equal(Number(r.width_feet),16.36);assert.equal(Number(r.length_feet),16);
}));
