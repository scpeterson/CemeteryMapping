import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
const migration=await readFile(new URL('../db/changelog/changes/499-shift-d25-group-west.sql',import.meta.url),'utf8');
const targets=['25','26','31','32','34','35','50','51','54','55'];
const deps=['lot_ownership_events','ownership_event_rights','historic_lot_map_gravesite_evidence','lot_restricted_areas'];
async function fixture(run){
 const cfg=loadApiConfig();assert.equal(cfg.appEnv,'test');const c=new pg.Client(integrationAdminDatabase(cfg));await c.connect();
 try{
  await c.query('BEGIN');
  await c.query('CREATE TEMP TABLE lots (LIKE public.lots INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP');
  await c.query('CREATE TEMP TABLE cemeteries(id uuid,geometry geometry(MultiPolygon,4326),deleted_at timestamptz) ON COMMIT DROP');
  await c.query('CREATE TEMP TABLE gravesites(id uuid DEFAULT gen_random_uuid(),cemetery_id uuid,lot_uuid uuid,deleted_at timestamptz) ON COMMIT DROP');
  await c.query('CREATE TEMP TABLE headstones(id uuid DEFAULT gen_random_uuid(),headstone_id text,gravesite_uuid uuid,geometry geometry(Point,4326),deleted_at timestamptz) ON COMMIT DROP');
  for(const t of deps)await c.query(`CREATE TEMP TABLE ${t}(lot_uuid uuid) ON COMMIT DROP`);
  await c.query(`INSERT INTO cemeteries VALUES('00000000-0000-4000-8000-000000000001',ST_Multi(ST_MakeEnvelope(-80.082,40.600,-80.078,40.603,4326)),NULL)`);
  await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,name,width_feet,length_feet,burial_use_status,burial_use_notes,geometry)
   SELECT c.id,'1','D',v.label,'D-'||v.label,16.36,16,CASE WHEN v.label='54' THEN 'non_burial' ELSE 'standard' END,
   CASE WHEN v.label='54' THEN 'Cannot contain gravesites or monuments.' END,
   ST_Multi(ST_MakeEnvelope(-80.0800956+v.col*0.00006,40.601715+v.row*0.000044,-80.0800956+(v.col+1)*0.00006,40.601715+(v.row+1)*0.000044,4326))
   FROM cemeteries c CROSS JOIN(VALUES('54',-4,1),('51',-3,1),('34',-2,1),('32',-1,1),('25',0,1),('55',-4,0),('50',-3,0),('35',-2,0),('31',-1,0),('26',0,0)) v(label,col,row)`);
  await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,name,geometry,deleted_at,delete_reason)
   SELECT id,'1','D','TMP03','D-TEMP-03',ST_Multi(ST_MakeEnvelope(-80.08050,40.60161,-80.08044,40.601654,4326)),now(),'defunct' FROM cemeteries`);
  await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,geometry)
   SELECT id,'1','D','77',ST_Multi(ST_MakeEnvelope(-80.081,40.601,-80.0809,40.6011,4326)) FROM cemeteries`);
  const g=(await c.query('INSERT INTO gravesites(cemetery_id) SELECT id FROM cemeteries RETURNING id')).rows[0].id;
  await c.query(`INSERT INTO headstones(headstone_id,gravesite_uuid,geometry) VALUES('TLC-HS-0447',$1,ST_SetSRID(ST_MakePoint(-80.0800956686,40.601802),4326))`,[g]);
  await run(c);
 }finally{await c.query('ROLLBACK');await c.end();}
}
test('ten lots move west together with one inch marker clearance and unchanged identifiers, restrictions and history',()=>fixture(async c=>{
 await c.query('CREATE TEMP TABLE before_lots AS SELECT * FROM lots');
 const marker=(await c.query('SELECT to_jsonb(h) data FROM headstones h')).rows;
 const graves=(await c.query('SELECT to_jsonb(g) data FROM gravesites g')).rows;
 await c.query(migration);
 const rows=(await c.query('SELECT to_jsonb(l) saved,to_jsonb(b) original,ST_XMin(Box2D(l.geometry))-ST_XMin(Box2D(b.geometry)) dx,ST_YMin(Box2D(l.geometry))-ST_YMin(Box2D(b.geometry)) dy,ST_HausdorffDistance(l.geometry,ST_Translate(b.geometry,ST_XMin(Box2D(l.geometry))-ST_XMin(Box2D(b.geometry)),0)) error FROM lots l JOIN before_lots b USING(id)')).rows;
 const shifts=[];
 for(const r of rows){
  if(!targets.includes(r.original.lot_id)){assert.deepEqual(r.saved,r.original);continue;}
  assert.ok(r.dx<0);assert.equal(r.dy,0);assert.ok(r.error<1e-11);shifts.push(r.dx);
  const allowed=['geometry','geometry_source','geometry_notes','updated_at'];
  for(const k of Object.keys(r.original).filter(k=>!allowed.includes(k)))assert.deepEqual(r.saved[k],r.original[k],k);
 }
 assert.equal(shifts.length,10);assert.ok(Math.max(...shifts)-Math.min(...shifts)<1e-12);
 const containment=(await c.query(`SELECT ST_ContainsProperly(l.geometry,h.geometry) inside,ST_Distance(ST_Boundary(l.geometry)::geography,h.geometry::geography)/0.0254 inches FROM lots l CROSS JOIN headstones h WHERE lot_id='25'`)).rows[0];
 assert.ok(containment.inside);assert.ok(Math.abs(containment.inches-1)<1e-5);
 assert.deepEqual((await c.query('SELECT to_jsonb(h) data FROM headstones h')).rows,marker);
 assert.deepEqual((await c.query('SELECT to_jsonb(g) data FROM gravesites g')).rows,graves);
}));
for(const [name,sql,pattern] of [
 ['missing anchor',"DELETE FROM lots WHERE lot_id='25'",/active D-25/],
 ['missing intervening lot',"DELETE FROM lots WHERE lot_id='31'",/all ten/],
 ['missing D-32',"DELETE FROM lots WHERE lot_id='32'",/all ten/],
 ['missing marker',"DELETE FROM headstones",/active TLC-HS-0447/],
 ['wrong marker cemetery',"UPDATE gravesites SET cemetery_id='00000000-0000-4000-8000-000000000002'",/this cemetery/],
 ['marker latitude cannot fit',"UPDATE headstones SET geometry=ST_Translate(geometry,0,0.001)",/westward-only/],
 ['cemetery boundary conflict',"UPDATE cemeteries SET geometry=ST_Multi(ST_MakeEnvelope(-80.0803357,40.60,-80.078,40.603,4326))",/inside the cemetery/],
 ['neighbor overlap',"INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,geometry) SELECT cemetery_id,'1','D','OTHER',ST_Translate(geometry,-0.000003,0) FROM lots WHERE lot_id='54'",/overlap other/],
 ['empty footprint',"UPDATE lots SET geometry=ST_GeomFromText('MULTIPOLYGON EMPTY',4326) WHERE lot_id='54'",/valid nonempty/],
])test(`D-25 correction refuses ${name}`,()=>fixture(async c=>{await c.query(sql);await assert.rejects(c.query(migration),pattern);}));
for(const table of ['gravesites',...deps])test(`D-25 correction refuses ${table} dependencies`,()=>fixture(async c=>{
 await c.query(`INSERT INTO ${table}(lot_uuid) SELECT id FROM lots WHERE lot_id='25'`);await assert.rejects(c.query(migration),/no.*dependencies/);
}));
test('D-25 correction skips databases without active Trinity Section D lots',()=>fixture(async c=>{
 await c.query('DELETE FROM lots');await c.query(migration);assert.equal((await c.query('SELECT count(*) FROM lots')).rows[0].count,'0');
}));
