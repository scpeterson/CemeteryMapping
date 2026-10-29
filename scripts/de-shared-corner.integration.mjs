import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
const migration=await readFile(new URL('../db/changelog/changes/501-deflect-de-shared-corner.sql',import.meta.url),'utf8');
const sections=[{"section_id":"625b1e92-4790-44dc-a53e-8efad6f3120f","name":"E","geometry":{"type":"MultiPolygon","coordinates":[[[[-80.080702786,40.6020255722],[-80.0806971418,40.6018691581],[-80.0806272484,40.6018886237],[-80.0806130838,40.6016425684],[-80.0806872433,40.60162378],[-80.0806870726,40.6016177671],[-80.080469586,40.601603927],[-80.0802188815,40.6018765372],[-80.080702786,40.6020255722]]]]}},{"section_id":"5009645b-1707-47e1-9e8c-2e45c8353ce7","name":"D","geometry":{"type":"MultiPolygon","coordinates":[[[[-80.0800220049,40.6016049739],[-80.0800142587,40.6016073051],[-80.0800209341,40.6018155725],[-80.0802188815,40.6018765372],[-80.080469586,40.601603927],[-80.0806870726,40.6016177671],[-80.0806864061,40.6015942398],[-80.080670081,40.6015779614],[-80.0806439292,40.601558615],[-80.0806278359,40.6015504693],[-80.0805909556,40.6015428324],[-80.0805534051,40.6015433412],[-80.0800816701,40.6015471689],[-80.0800683894,40.6015794598],[-80.08006122,40.6015901803],[-80.0800395553,40.6015994909],[-80.0800220049,40.6016049739]]]]}}];
const markers=[{"headstone_id":"TLC-HS-0577","geometry":{"type":"Point","coordinates":[-80.08052225452694,40.60161014982037]}},{"headstone_id":"TLC-HS-0554","geometry":{"type":"Point","coordinates":[-80.08049804452803,40.6016167617955]}}];
async function fixture(run){
 const cfg=loadApiConfig();assert.equal(cfg.appEnv,'test');const c=new pg.Client(integrationAdminDatabase(cfg));await c.connect();
 try{await c.query('BEGIN');
 await c.query(`CREATE TEMP TABLE cemeteries(id uuid,facility_id text,deleted_at timestamptz) ON COMMIT DROP;
 CREATE TEMP TABLE sections(section_id uuid,cemetery_id uuid,name text,geometry geometry(MultiPolygon,4326),deleted_at timestamptz,updated_at timestamptz) ON COMMIT DROP;
 CREATE TEMP TABLE gravesites(id uuid,cemetery_id uuid,deleted_at timestamptz) ON COMMIT DROP;
 CREATE TEMP TABLE headstones(headstone_id text,gravesite_uuid uuid,geometry geometry(Point,4326),deleted_at timestamptz) ON COMMIT DROP;
 INSERT INTO cemeteries VALUES('00000000-0000-4000-8000-000000000001','1',NULL);
 INSERT INTO gravesites SELECT id,id,NULL FROM cemeteries`);
 for(const s of sections)await c.query(`INSERT INTO sections SELECT $1,id,$2,ST_SetSRID(ST_GeomFromGeoJSON($3),4326),NULL,now() FROM cemeteries`,[s.section_id,s.name,JSON.stringify(s.geometry)]);
 for(const m of markers)await c.query(`INSERT INTO headstones SELECT $1,id,ST_SetSRID(ST_GeomFromGeoJSON($2),4326),NULL FROM gravesites`,[m.headstone_id,JSON.stringify(m.geometry)]);
 await c.query(`INSERT INTO sections SELECT gen_random_uuid(),cemetery_id,'OTHER',geometry,NULL,now() FROM sections WHERE name='D'`);
 await run(c);
 }finally{await c.query('ROLLBACK');await c.end();}
}
test('only the shared corner deflects north, preserving all other vertices, combined footprint and fixed records',()=>fixture(async c=>{
 const before=(await c.query('SELECT name,ST_AsGeoJSON(geometry,15)::json geometry,updated_at FROM sections ORDER BY name')).rows;
 const fixed=(await c.query('SELECT to_jsonb(h) data FROM headstones h ORDER BY headstone_id')).rows;
 await c.query(migration);
 const after=(await c.query('SELECT name,ST_AsGeoJSON(geometry,15)::json geometry,updated_at FROM sections ORDER BY name')).rows;
 for(let i=0;i<before.length;i++){
  if(before[i].name==='OTHER'){assert.deepEqual(after[i],before[i]);continue;}
  const index=before[i].name==='D'?4:6; const a=after[i].geometry.coordinates[0][0],b=before[i].geometry.coordinates[0][0];
  assert.equal(a.length,b.length);
  for(let j=0;j<a.length;j++)if(j!==index)assert.deepEqual(a[j],b[j]);
  assert.equal(a[index][0],b[index][0]);assert.ok(a[index][1]>b[index][1]);
 }
 const result=(await c.query(`SELECT s.name,h.headstone_id,ST_ContainsProperly(s.geometry,h.geometry) inside FROM sections s CROSS JOIN headstones h WHERE s.name IN('D','E')`)).rows;
 for(const r of result)assert.equal(r.inside,(r.name==='D')===(r.headstone_id==='TLC-HS-0577'));
 assert.deepEqual((await c.query('SELECT to_jsonb(h) data FROM headstones h ORDER BY headstone_id')).rows,fixed);
}));
for(const [name,sql,pattern] of [
 ['missing section',"DELETE FROM sections WHERE name='D'",/both active sections/],
 ['missing marker',"DELETE FROM headstones WHERE headstone_id='TLC-HS-0554'",/both active fixed markers/],
 ['wrong cemetery',"UPDATE gravesites SET cemetery_id=gen_random_uuid()",/both active fixed markers/],
 ['changed corner',"UPDATE sections SET geometry=ST_Translate(geometry,.00001,0) WHERE name='E'",/reviewed shared/],
 ['null outline',"UPDATE sections SET geometry=NULL WHERE name='E'",/valid single-polygon/],
 ['wrong marker side',"UPDATE headstones SET geometry=ST_Translate(geometry,0,.0001) WHERE headstone_id='TLC-HS-0577'",/north-only|each fixed marker/],
])test(`D/E boundary refuses ${name}`,()=>fixture(async c=>{await c.query(sql);await assert.rejects(c.query(migration),pattern);}));
test('D/E correction skips a database without Trinity sections',()=>fixture(async c=>{
 await c.query('DELETE FROM sections');await c.query(migration);
}));
