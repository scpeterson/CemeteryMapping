import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';

const migration=await readFile(new URL('../db/changelog/changes/495-shift-section-a-eighteen-lots-north.sql',import.meta.url),'utf8');
const cemetery='00000000-0000-4000-8000-000000000001';
async function fixture(run){
 const config=loadApiConfig();assert.equal(config.appEnv,'test');
 const c=new pg.Client(integrationAdminDatabase(config));await c.connect();
 try{
  await c.query('BEGIN');
  await c.query('CREATE TEMP TABLE lots (LIKE public.lots INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP');
  await c.query('CREATE TEMP TABLE headstones(id uuid DEFAULT gen_random_uuid(),headstone_id text,gravesite_uuid uuid,deleted_at timestamptz,geometry geometry(Point,4326)) ON COMMIT DROP');
  await c.query('CREATE TEMP TABLE gravesites(id uuid DEFAULT gen_random_uuid(),cemetery_id uuid,deleted_at timestamptz,geometry geometry(Polygon,4326)) ON COMMIT DROP');
  await c.query('CREATE TEMP TABLE cemeteries(id uuid,geometry geometry(MultiPolygon,4326)) ON COMMIT DROP');
  await c.query(`INSERT INTO cemeteries VALUES($1,ST_Multi(ST_MakeEnvelope(-80.081,40.600,-80.078,40.603,4326)))`,[cemetery]);
  await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,width_feet,length_feet,geometry)
   SELECT $1,'1','A',number::text,10,20,
    ST_Multi(ST_MakeEnvelope(-80.080046353+col*0.000036062111111,40.601203005+row*0.000054761,
     -80.080046353+(col+1)*0.000036062111111,40.601203005+(row+1)*0.000054761,4326))
   FROM (SELECT n number,9-n col,1 row FROM generate_series(1,9) n
         UNION ALL SELECT n,n-30,0 FROM generate_series(30,38) n) grid`,[cemetery]);
  await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,geometry)
   SELECT cemetery_id,facility_id,section_id,'99',ST_Translate(geometry,0,-0.001) FROM lots WHERE lot_id='34'`);
  const grave=(await c.query(`INSERT INTO gravesites(cemetery_id,geometry) VALUES($1,ST_MakeEnvelope(-80.0799,40.60124,-80.07989,40.60125,4326)) RETURNING id`,[cemetery])).rows[0].id;
  await c.query(`INSERT INTO headstones(headstone_id,gravesite_uuid,geometry) VALUES('TLC-HS-0053',$1,ST_SetSRID(ST_MakePoint(-80.079899685,40.601258833),4326))`,[grave]);
  await run(c);
 }finally{await c.query('ROLLBACK');await c.end();}
}

test('eighteen lots translate one foot north together, containing the fixed marker without changing other records',()=>fixture(async c=>{
 await c.query('CREATE TEMP TABLE before_lots AS SELECT * FROM lots');
 const markerBefore=(await c.query('SELECT to_jsonb(h) data FROM headstones h')).rows;
 const gravesBefore=(await c.query('SELECT to_jsonb(g) data FROM gravesites g')).rows;
 assert.equal((await c.query(`SELECT ST_ContainsProperly(l.geometry,h.geometry) inside FROM lots l CROSS JOIN headstones h WHERE lot_id='34'`)).rows[0].inside,false);
 await c.query(migration);
 const result=(await c.query(`WITH shifts AS(SELECT l.*,o.geometry original,
  ST_XMin(Box2D(l.geometry))-ST_XMin(Box2D(o.geometry)) dx,
  ST_YMin(Box2D(l.geometry))-ST_YMin(Box2D(o.geometry)) dy
  FROM lots l JOIN before_lots o USING(id) WHERE l.lot_id<>'99')
  SELECT count(*) count,bool_and(dx=0 AND dy>0) north_only,
  max(dy)-min(dy) delta_range,bool_and(ST_Equals(geometry,ST_Translate(original,dx,dy))) same_shape,
  bool_and(width_feet=10 AND length_feet=20) dimensions,
  min(ST_Distance(ST_Centroid(original)::geography,ST_Centroid(geometry)::geography)/0.3048) min_feet,
  max(ST_Distance(ST_Centroid(original)::geography,ST_Centroid(geometry)::geography)/0.3048) max_feet FROM shifts`)).rows[0];
 assert.equal(result.count,'18');
 for(const key of ['north_only','same_shape','dimensions'])assert.equal(result[key],true,key);
 assert.ok(result.delta_range<1e-12);assert.ok(Math.abs(result.min_feet-1)<1e-5&&Math.abs(result.max_feet-1)<1e-5);
 assert.equal((await c.query(`SELECT bool_and((to_jsonb(l)-ARRAY['geometry','geometry_source','geometry_notes','updated_at'])=(to_jsonb(o)-ARRAY['geometry','geometry_source','geometry_notes','updated_at'])) preserved FROM lots l JOIN before_lots o USING(id)`)).rows[0].preserved,true);
 assert.equal((await c.query(`SELECT to_jsonb(l)=to_jsonb(o) unchanged FROM lots l JOIN before_lots o USING(id) WHERE l.lot_id='99'`)).rows[0].unchanged,true);
 assert.equal((await c.query(`SELECT ST_ContainsProperly(l.geometry,h.geometry) inside FROM lots l CROSS JOIN headstones h WHERE lot_id='34'`)).rows[0].inside,true);
 const edges=table=>c.query(`SELECT count(*) FROM ${table} a JOIN ${table} b ON a.lot_id<b.lot_id WHERE a.lot_id<>'99' AND b.lot_id<>'99' AND ST_Length(ST_Intersection(ST_Boundary(a.geometry),ST_Boundary(b.geometry)))>0`);
 assert.equal((await edges('lots')).rows[0].count,'25');assert.equal((await edges('lots')).rows[0].count,(await edges('before_lots')).rows[0].count);
 assert.deepEqual((await c.query('SELECT to_jsonb(h) data FROM headstones h')).rows,markerBefore);
 assert.deepEqual((await c.query('SELECT to_jsonb(g) data FROM gravesites g')).rows,gravesBefore);
}));

for(const [name,sql,pattern] of [
 ['missing group member',"DELETE FROM lots WHERE lot_id='1'",/all eighteen/],
 ['missing marker',"DELETE FROM headstones",/active TLC-HS-0053/],
 ['wrong marker cemetery',"UPDATE gravesites SET cemetery_id='00000000-0000-4000-8000-000000000002'",/same cemetery/],
 ['marker cannot fit by moving north',"UPDATE headstones SET geometry=ST_Translate(geometry,0.001,0)",/strictly inside/],
 ['neighboring overlap',"INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,geometry) SELECT cemetery_id,facility_id,section_id,'100',ST_Translate(geometry,0,0.000003) FROM lots WHERE lot_id='1'",/must not overlap/],
 ['cemetery boundary crossing',"UPDATE cemeteries SET geometry=ST_Multi(ST_MakeEnvelope(-80.081,40.600,-80.078,40.601312527,4326))",/inside the cemetery/],
 ['empty footprint',"UPDATE lots SET geometry=ST_GeomFromText('MULTIPOLYGON EMPTY',4326) WHERE lot_id='1'",/valid lots/],
])test(`eighteen-lot shift refuses ${name}`,()=>fixture(async c=>{
 await c.query(sql);await assert.rejects(c.query(migration),pattern);
}));

test('eighteen-lot shift skips databases without Trinity Section A',()=>fixture(async c=>{
 await c.query('DELETE FROM lots');await c.query(migration);assert.equal((await c.query('SELECT count(*) FROM lots')).rows[0].count,'0');
}));
