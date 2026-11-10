import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
import {runReport} from '../server/reportsRepository.mjs';

test('unreadable report uses only latest active inspections and respects locations and access',async()=>{
 const pool=new pg.Pool(integrationAdminDatabase(loadApiConfig()));const client=await pool.connect();
 try{
  await client.query('BEGIN');
  for(const table of ['cemeteries','sections','gravesites','headstones','headstone_gravesites','headstone_burials','burials','marker_types','marker_scope_types','monument_inspections']) await client.query(`CREATE TEMP TABLE ${table} ON COMMIT DROP AS SELECT * FROM public.${table} WHERE false`);
  for(const table of ['headstones','cemeteries'])await client.query(`ALTER TABLE ${table} ADD PRIMARY KEY (id)`);
  const cemetery=randomUUID(),other=randomUUID();
  await client.query(`INSERT INTO cemeteries(id,name,geometry) VALUES($1,'Allowed',ST_MakeEnvelope(-1,-1,1,1,4326)),($2,'Other',ST_MakeEnvelope(9,9,11,11,4326))`,[cemetery,other]);
  const add=async(name,{linked=true,cem=cemetery,deleted=false}={})=>{const marker=randomUUID(),grave=randomUUID();
   if(linked)await client.query("INSERT INTO gravesites(id,cemetery_id,gravesite_id,display_label,section_id) VALUES($1,$2,$3::text,$3::text,'E')",[grave,cem,name]);
   await client.query(`INSERT INTO headstones(id,headstone_id,gravesite_uuid,geometry,deleted_at) VALUES($1,$2,$3,ST_SetSRID(ST_MakePoint($4,$4),4326),CASE WHEN $5 THEN now() END)`,[marker,name,linked?grave:null,cem===cemetery?0:10,deleted]);return {marker,grave};};
  const inspection=async(marker,year,text,{date=null,faces=[],deleted=false,created='2026-01-01'}={})=>client.query(`INSERT INTO monument_inspections(id,headstone_uuid,inspection_year,inspected_at,inscription,faces,source,deleted_at,created_at) VALUES($1,$2,$3,$4,$5,$6,'Fixture inspection',CASE WHEN $7 THEN now() END,$8)`,[randomUUID(),marker,year,date,text,JSON.stringify(faces),deleted,created]);
  const oldBad=await add('OLD-BAD');await inspection(oldBad.marker,2005,'[illegible]');await inspection(oldBad.marker,2026,'Readable name');
  const currentBad=await add('CURRENT-BAD');await inspection(currentBad.marker,2005,'Readable');await inspection(currentBad.marker,2026,'Name [ILLEGIBLE LINES] [-]');await inspection(currentBad.marker,2027,'Readable but deleted',{deleted:true});
  const faceBad=await add('FACE-BAD');await inspection(faceBad.marker,2026,'Readable',{faces:[{label:'Back',inscription:'[ - ]'}]});
  const plotScope=randomUUID();await client.query("INSERT INTO marker_scope_types(id,code,label) VALUES($1,'plot_marker','Plot marker')",[plotScope]);
  await client.query('UPDATE headstones SET marker_scope_type_id=$2 WHERE id=$1',[faceBad.marker,plotScope]);
  const standalone=await add('STANDALONE',{linked:false});await inspection(standalone.marker,2026,'illegible');
  const oldCreated=await add('DATE-ORDER');await inspection(oldCreated.marker,2026,'illegible',{date:'2026-01-01',created:'2026-12-01'});await inspection(oldCreated.marker,2026,'Readable',{date:'2026-02-01',created:'2026-03-01'});
  const tie=await add('CREATED-ORDER');await inspection(tie.marker,2026,'illegible',{created:'2026-01-01'});await inspection(tie.marker,2026,'Readable',{created:'2026-02-01'});
  const empty=await add('EMPTY-NEWEST');await inspection(empty.marker,2005,'illegible');await inspection(empty.marker,2026,'');
  const deleted=await add('DELETED',{deleted:true});await inspection(deleted.marker,2026,'illegible');
  const noInspection=await add('NO-INSPECTION');await client.query("UPDATE headstones SET inscription='illegible' WHERE id=$1",[noInspection.marker]);
  const foreign=await add('OTHER',{cem:other});await inspection(foreign.marker,2026,'illegible');
  // Sharing an existing primary location must not duplicate the result.
  await client.query('INSERT INTO headstone_gravesites(headstone_uuid,gravesite_uuid) VALUES($1,$2)',[currentBad.marker,currentBad.grave]);
  const reportPool={connect:async()=>({query:(...args)=>client.query(...args),release(){}})};
  const user={role:'power-user',cemeteryAccess:[{cemeteryId:cemetery,role:'power-user'}]};
  const result=await runReport(reportPool,'unreadable-monument-inscriptions',{},user);
  assert.deepEqual(result.rows.map(r=>r.monument).sort(),['CURRENT-BAD','FACE-BAD','STANDALONE']);
  assert.equal(result.rows.find(r=>r.monument==='FACE-BAD').affected_surfaces,'Back');
  assert.equal(result.rows.find(r=>r.monument==='FACE-BAD').marker_scope,'Plot marker');
  assert.equal(result.rows.find(r=>r.monument==='STANDALONE').gravesites,'Standalone marker');
  assert.equal(result.rows.find(r=>r.monument==='CURRENT-BAD').monumentRecord.cemeteryId,cemetery);
  assert.match(result.summary,/3 monuments/u);
  assert.equal((await runReport(reportPool,'unreadable-monument-inscriptions',{}, {role:'power-user',cemeteryAccess:[]})).rows.length,0);
 }finally{await client.query('ROLLBACK');client.release();await pool.end();}
});
