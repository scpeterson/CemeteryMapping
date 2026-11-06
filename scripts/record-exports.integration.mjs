import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
import {exportRecords,validateExportOptions} from '../server/recordExportRepository.mjs';

test('scoped CSV/GeoJSON exports omit private fields, deleted records and partial files',async()=>{
 const client=new pg.Client(integrationAdminDatabase(loadApiConfig()));await client.connect();
 try{
  await client.query('BEGIN');const pool={connect:async()=>({release(){},query(sql,values){if(sql.startsWith('BEGIN'))return client.query('SAVEPOINT export_read');if(sql==='COMMIT')return client.query('RELEASE SAVEPOINT export_read');if(sql==='ROLLBACK')return client.query('ROLLBACK TO SAVEPOINT export_read');return client.query(sql,values);}})},admin={role:'admin'};
  const cemetery=(await client.query('SELECT id FROM cemeteries WHERE deleted_at IS NULL LIMIT 1')).rows[0];assert.ok(cemetery);
  for(const dataset of ['gravesites','people','markers','maintenance','ownership']){
   const result=await exportRecords(pool,cemetery.id,validateExportOptions({dataset,format:'csv',q:randomUUID()}),admin);assert.equal(result.count,0);assert.ok(result.content.startsWith('\uFEFF'));
  }
  const grave=(await client.query('SELECT id,gravesite_id FROM gravesites WHERE cemetery_id=$1 AND deleted_at IS NULL LIMIT 1',[cemetery.id])).rows[0];
  const geo=await exportRecords(pool,cemetery.id,validateExportOptions({dataset:'gravesites',format:'geojson',q:grave.gravesite_id}),admin);const collection=JSON.parse(geo.content);assert.equal(collection.type,'FeatureCollection');assert.ok(collection.features.some(f=>f.id===grave.id));assert.ok(collection.features.every(f=>f.properties.phone===undefined&&f.properties.email===undefined&&f.properties.cost===undefined));
  const id=randomUUID();await client.query(`INSERT INTO burials(id,gravesite_uuid,first_name,last_name,full_name,interment_type_id,burial_record_status_type_id) VALUES($1,$2,'=CMD()','Export fixture','=CMD() Export fixture',(SELECT id FROM burial_interment_types WHERE code='unknown'),(SELECT id FROM burial_record_status_types WHERE code='interred'))`,[id,grave.id]);
  let people=await exportRecords(pool,cemetery.id,validateExportOptions({dataset:'people',format:'csv',q:'Export fixture'}),admin);assert.equal(people.count,1);assert.ok(people.content.includes('"\'=CMD()"'));assert.ok(!people.content.includes('phone'));
  await client.query('UPDATE burials SET deleted_at=now() WHERE id=$1',[id]);people=await exportRecords(pool,cemetery.id,validateExportOptions({dataset:'people',format:'csv',q:'Export fixture'}),admin);assert.equal(people.count,0);
  await assert.rejects(()=>exportRecords(pool,cemetery.id,validateExportOptions({dataset:'gravesites',format:'csv',limit:'1'}),admin),/no partial export/);
  const denied=await exportRecords(pool,cemetery.id,validateExportOptions({dataset:'ownership',format:'csv'}),{role:'reader',cemeteryAccess:[{cemeteryId:cemetery.id,role:'reader',canEdit:false}]});assert.equal(denied.forbidden,true);
 }finally{await client.query('ROLLBACK');await client.end();}
});
